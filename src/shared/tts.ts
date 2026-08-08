import { loadSettings } from './settings';

/** Engines choke on very long utterances, so the article is queued in pieces. */
export const MAX_CHUNK = 1200;

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
    if (SENTENCE_END.test(word) && text.length > MAX_CHUNK / 3) flush(i + 1);
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
  chrome.tts.stop();

  queue.forEach((utterance, i) => {
    const last = i === queue.length - 1;
    chrome.tts.speak(utterance.text, {
      voiceName,
      rate: rateForWpm(wpm, ttsRate),
      pitch: ttsPitch,
      enqueue: i > 0,
      onEvent: (event) => {
        if (event.type === 'word' || event.type === 'sentence') {
          handlers.onProgress(i, event.charIndex ?? 0);
          return;
        }
        if (event.type === 'error' || event.type === 'interrupted' || event.type === 'cancelled') handlers.onDone();
        else if (last && event.type === 'end') handlers.onDone();
      },
    });
  });
  return { ok: true };
}
