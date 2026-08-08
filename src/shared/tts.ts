import { loadSettings } from './settings';

/** Engines choke on very long utterances, so the article is queued in pieces. */
export const MAX_CHUNK = 1200;
/**
 * The first piece is cut short at the first sentence past this. Engines that report
 * nothing finer than an utterance give the reader no way to time the voice until the
 * second one starts, and a full-length first piece leaves that 200 words away.
 */
export const FIRST_CHUNK = 160;

/** Roughly what chrome.tts voices speak at rate 1.0, used to map wpm onto a rate. */
export const TTS_BASE_WPM = 180;

const SENTENCE_END = /[.!?…]["'”’)\]]?$/;

export interface Utterance {
  text: string;
  /** Index into the words array of this utterance's first word. */
  startWord: number;
  /** Char offset of each word inside `text`, for mapping a spoken charIndex back to a word. */
  wordStarts: number[];
}

/**
 * Splits on sentence ends where it can, and tracks where every word begins so a
 * `word` event's charIndex can be turned back into a reader position.
 */
export function utterances(words: string[]): Utterance[] {
  const out: Utterance[] = [];
  let text = '';
  let wordStarts: number[] = [];
  let startWord = 0;

  const flush = (nextStart: number) => {
    if (text.length === 0) return;
    out.push({ text, startWord, wordStarts });
    text = '';
    wordStarts = [];
    startWord = nextStart;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (word.length === 0) continue;
    if (text.length + word.length + 1 > MAX_CHUNK) flush(i);
    if (text.length > 0) text += ' ';
    wordStarts.push(text.length);
    text += word;
    const flushAfter = out.length === 0 ? FIRST_CHUNK : MAX_CHUNK / 3;
    if (SENTENCE_END.test(word) && text.length > flushAfter) flush(i + 1);
  }
  flush(words.length);
  return out;
}

/** Word index inside an utterance for a spoken charIndex. */
export function wordAtChar(utterance: Utterance, charIndex: number): number {
  let word = 0;
  for (let i = 0; i < utterance.wordStarts.length; i++) {
    if (utterance.wordStarts[i]! > charIndex) break;
    word = i;
  }
  return word;
}

/** Speech tracks the reading speed; the stored rate is a per-voice calibration on top. */
export function rateForWpm(wpm: number, calibration: number): number {
  const rate = (wpm / TTS_BASE_WPM) * calibration;
  return Math.min(10, Math.max(0.1, Math.round(rate * 100) / 100));
}

/** How often the voice is polled while the first piece is timed; also the worst-case gap. */
const POLL_MS = 50;
/** If the voice has not begun by now, give up timing it and keep the audio flowing. */
const START_CAP_MS = 5000;
/** Even a voice crawling at rate 0.1 finishes a 160-character piece inside this. */
const FIRST_PIECE_CAP_MS = 120_000;

/** Bumped by every speak and stop, so timing in flight knows it has been abandoned. */
let epoch = 0;

/** Stops the voice and abandons any timing still in flight. */
export function stopSpeaking(): void {
  epoch++;
  chrome.tts.stop();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isSpeaking = () => new Promise<boolean>((resolve) => chrome.tts.isSpeaking((speaking) => resolve(speaking)));

/** Polls until the voice reaches `want`, or until waiting stops being worth it. */
async function until(want: boolean, capMs: number, worthwhile: () => boolean): Promise<boolean> {
  for (let waited = 0; waited < capMs; waited += POLL_MS) {
    if (!worthwhile()) return false;
    if (await isSpeaking() === want) return true;
    await wait(POLL_MS);
  }
  return false;
}

export type SpeakResult = { ok: true } | { ok: false; reason: string };

export interface SpeakHandlers {
  onProgress: (utterance: number, charIndex: number) => void;
  onDone: () => void;
}

/**
 * chrome.tts is only reachable from privileged extension contexts, so content
 * scripts route read-aloud through the service worker. Speech keeps running
 * there even after the page navigates away.
 */
export async function speak(words: string[], wpm: number, handlers: SpeakHandlers): Promise<SpeakResult> {
  const queue = utterances(words);
  if (queue.length === 0) return { ok: false, reason: 'Nothing to read aloud.' };

  const voices = await chrome.tts.getVoices();
  if (voices.length === 0) {
    return { ok: false, reason: 'No text-to-speech voice is installed in this browser.' };
  }

  const { ttsVoice, ttsRate, ttsPitch } = await loadSettings();
  const voiceName = voices.some((voice) => voice.voiceName === ttsVoice) ? ttsVoice : undefined;
  epoch++;
  const mine = epoch;
  chrome.tts.stop();

  // `reported` means the reader has been placed by something other than polling for
  // silence, so polling has nothing left to add. `over` means the voice has stopped.
  let reported = false;
  let over = false;
  let queued = false;

  const queueRest = () => {
    if (queued || epoch !== mine || over) return;
    queued = true;
    for (let i = 1; i < queue.length; i++) say(i);
  };

  const say = (i: number) => {
    const last = i === queue.length - 1;
    chrome.tts.speak(queue[i]!.text, {
      voiceName,
      rate: rateForWpm(wpm, ttsRate),
      pitch: ttsPitch,
      enqueue: i > 0,
      // Asked for, not required: a voice that reports words lets the reader follow exactly,
      // but a voice that reports none is still better than refusing to speak. The list has
      // to name every type handled below, since anything left out may not be delivered.
      desiredEventTypes: ['word', 'sentence', 'start', 'end', 'error', 'interrupted', 'cancelled'],
      onEvent: (event) => {
        // An utterance starting places the reader exactly; on engines with no word
        // events it is the only correction the display ever gets.
        if (event.type === 'start') {
          reported = true;
          handlers.onProgress(i, 0);
          return;
        }
        if (event.type === 'word' || event.type === 'sentence') {
          reported = true;
          handlers.onProgress(i, event.charIndex ?? 0);
          return;
        }
        if (event.type === 'end' && !last) {
          // A piece ending is an exact boundary, so an engine that reports only this much
          // still times the voice for the reader, and more precisely than silence does.
          if (i === 0 && !reported) {
            reported = true;
            handlers.onProgress(1, 0);
          }
          queueRest();
          return;
        }
        if (event.type === 'error' || event.type === 'interrupted' || event.type === 'cancelled') {
          over = true;
          handlers.onDone();
        } else if (last && event.type === 'end') {
          over = true;
          handlers.onDone();
        }
      },
    });
  };

  say(0);
  if (queue.length === 1) return { ok: true };

  /**
   * A voice that reports nothing leaves the reader unable to time it, and a rate the
   * engine may have ignored is all it would have to go on. So the first piece is spoken
   * alone and bounded by polling: silence marks its end, and a report either side of it
   * gives the reader a real measurement. The moment the engine reports for itself this
   * is pointless, so the rest is queued at once and a well-behaved voice pays nothing.
   */
  void (async () => {
    const worthwhile = () => epoch === mine && !over && !reported && !queued;
    // Waiting for the voice to begin keeps engine startup out of the measurement.
    if (!(await until(true, START_CAP_MS, worthwhile))) return queueRest();
    handlers.onProgress(0, 0);
    if (!(await until(false, FIRST_PIECE_CAP_MS, worthwhile))) return queueRest();
    handlers.onProgress(1, 0);
    queueRest();
  })();

  return { ok: true };
}
