import { pauseMultiplier } from './pauses';

export interface Token {
  text: string;
  pauseAfter: number;
}

const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const NUMBER_RE = /^[\d.,%$€£¥+-]*\d[\d.,%$€£¥+-]*$/;
const LEADING_PUNCT = new Set(['"', "'", '“', '‘', '(', '[', '{', '«', '‹']);
const TRAILING_PUNCT = new Set(['.', ',', '!', '?', ';', ':', '…', '"', '”', '’', ')', ']', '}', '»', '›', '—']);

export interface Paragraphized {
  tokens: Token[];
  starts: number[];
  paragraphs: string[];
}

export function tokenizeParagraphs(text: string): Paragraphized {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
  const raw = normalized.split(/\n\s*\n/);
  const paragraphs: string[] = [];
  const starts: number[] = [];
  const tokens: Token[] = [];

  for (const para of raw) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    paragraphs.push(para);
    starts.push(tokens.length);
    for (const w of words) tokens.push(tokenizeWord(w));
    tokens.push({ text: '', pauseAfter: 5 });
  }
  return { tokens, starts, paragraphs };
}

export function tokenize(text: string): Token[] {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n\s*\n/);
  const tokens: Token[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    for (const raw of words) {
      tokens.push(tokenizeWord(raw));
    }
    if (paragraphs.length > 1) tokens.push({ text: '', pauseAfter: 5 });
  }
  return tokens;
}

function tokenizeWord(raw: string): Token {
  if (URL_RE.test(raw)) return { text: raw, pauseAfter: 1 };
  if (NUMBER_RE.test(raw)) return { text: raw, pauseAfter: 1 };
  if (raw === '--') return { text: raw, pauseAfter: 1.5 };

  let word = raw;
  while (word.length > 0 && LEADING_PUNCT.has(word[0]!)) {
    word = word.slice(1);
  }

  let pauseChar: string | undefined;
  if (word.length > 0 && TRAILING_PUNCT.has(word[word.length - 1]!)) {
    pauseChar = word[word.length - 1];
    if (pauseChar === '"' || pauseChar === '”' || pauseChar === '’') {
      const inner = word[word.length - 2];
      if (inner && pauseMultiplier(inner) > 1) pauseChar = inner;
    }
  }

  if (word.length === 0) return { text: raw, pauseAfter: 1 };
  return { text: word, pauseAfter: pauseMultiplier(pauseChar) };
}

const SENTENCE_END = /[.!?…]["'”’)\]]?$/;

/**
 * First token of the sentence holding `index`. Speech restarts here after a pause
 * because chrome.tts cannot resume mid-utterance, and a fragment is jarring.
 */
export function sentenceStart(tokens: Token[], index: number): number {
  for (let i = Math.min(index, tokens.length - 1); i > 0; i--) {
    const previous = tokens[i - 1];
    if (!previous) break;
    if (previous.text === '' || SENTENCE_END.test(previous.text)) return i;
  }
  return 0;
}

export interface PlaybackSettings {
  wpm: number;
  smartPauses: boolean;
}

export function delayFor(token: Token, wpm: number, smartPauses: boolean): number {
  let delay = 60000 / wpm;
  if (smartPauses) {
    delay *= token.pauseAfter;
    if (token.text.length > 8) delay *= 1.25;
  }
  return delay;
}

export const WPM_STEP = 25;
export const WPM_MIN = 100;
export const WPM_MAX = 1000;

/** Every speed control moves in fixed WPM_STEP jumps, so up-then-down returns to where it started. */
export function stepWpm(wpm: number, direction: 1 | -1): number {
  const snapped = Math.round(wpm / WPM_STEP) * WPM_STEP;
  return Math.min(WPM_MAX, Math.max(WPM_MIN, snapped + direction * WPM_STEP));
}

export function applyWpmChange(current: PlaybackSettings, direction: 1 | -1): PlaybackSettings {
  return { ...current, wpm: stepWpm(current.wpm, direction) };
}
