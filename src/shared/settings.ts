export type FontSize = 'small' | 'medium' | 'large';
export type Theme = 'dark' | 'light' | 'sepia';
export type ReadingMode = 'focus' | 'flow' | 'spotlight';
export type FontFamily = 'system' | 'serif' | 'mono' | 'rounded';

export interface Settings {
  wpm: number;
  fontSize: FontSize;
  theme: Theme;
  smartPauses: boolean;
  wordsPerTick: number;
  readingMode: ReadingMode;
  fontFamily: FontFamily;
  /** chrome.tts voiceName; empty string means the system default voice. */
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
}

export const DEFAULT_SETTINGS: Settings = { wpm: 300, fontSize: 'medium', theme: 'dark', smartPauses: true, wordsPerTick: 1, readingMode: 'focus', fontFamily: 'system', ttsVoice: '', ttsRate: 1, ttsPitch: 1 };

const FONT_SIZES: FontSize[] = ['small', 'medium', 'large'];
const THEMES: Theme[] = ['dark', 'light', 'sepia'];
const READING_MODES: ReadingMode[] = ['focus', 'flow', 'spotlight'];
const FONT_FAMILIES: FontFamily[] = ['system', 'serif', 'mono', 'rounded'];

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const wpm = typeof r.wpm === 'number' ? Math.min(1000, Math.max(100, Math.round(r.wpm))) : DEFAULT_SETTINGS.wpm;
  const fontSize = FONT_SIZES.includes(r.fontSize as FontSize) ? (r.fontSize as FontSize) : DEFAULT_SETTINGS.fontSize;
  const theme = THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_SETTINGS.theme;
  const smartPauses = typeof r.smartPauses === 'boolean' ? r.smartPauses : DEFAULT_SETTINGS.smartPauses;
  const wordsPerTick = typeof r.wordsPerTick === 'number' ? Math.min(8, Math.max(1, Math.round(r.wordsPerTick))) : DEFAULT_SETTINGS.wordsPerTick;
  const readingMode = READING_MODES.includes(r.readingMode as ReadingMode) ? (r.readingMode as ReadingMode) : DEFAULT_SETTINGS.readingMode;
  const fontFamily = FONT_FAMILIES.includes(r.fontFamily as FontFamily) ? (r.fontFamily as FontFamily) : DEFAULT_SETTINGS.fontFamily;
  const ttsVoice = typeof r.ttsVoice === 'string' ? r.ttsVoice : DEFAULT_SETTINGS.ttsVoice;
  const ttsRate = clampNumber(r.ttsRate, 0.5, 2, DEFAULT_SETTINGS.ttsRate);
  const ttsPitch = clampNumber(r.ttsPitch, 0, 2, DEFAULT_SETTINGS.ttsPitch);
  return { wpm, fontSize, theme, smartPauses, wordsPerTick, readingMode, fontFamily, ttsVoice, ttsRate, ttsPitch };
}

function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw * 10) / 10));
}

export const SETTINGS_KEY = 'rr:settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}
