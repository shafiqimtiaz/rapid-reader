import { pauseMultiplier } from './pauses';

export interface Token {
  text: string;
  pauseAfter: number;
}

const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const NUMBER_RE = /^[\d.,%$€£¥+-]*\d[\d.,%$€£¥+-]*$/;
const LEADING_PUNCT = new Set(['"', "'", '“', '‘', '(', '[', '{', '«', '‹']);
const TRAILING_PUNCT = new Set(['.', ',', '!', '?', ';', ':', '…', '"', '”', '’', ')', ']', '}', '»', '›', '—']);

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

export function applyWpmChange(current: PlaybackSettings, direction: 1 | -1): PlaybackSettings {
  const next = Math.round((current.wpm * (direction > 0 ? 1.2 : 0.8)) / 10) * 10;
  return { ...current, wpm: Math.min(1000, Math.max(100, next)) };
}
