import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/shared/settings';

describe('normalizeSettings', () => {
  beforeEach(() => { globalThis.chrome = { storage: { sync: { get: async () => ({}), set: async () => {} } } } as unknown as typeof chrome; });
  it('returns defaults for empty input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps wpm to 100-1000', () => {
    expect(normalizeSettings({ wpm: 5 }).wpm).toBe(100);
    expect(normalizeSettings({ wpm: 5000 }).wpm).toBe(1000);
  });
  it('rejects invalid enum values', () => {
    expect(normalizeSettings({ theme: 'neon' }).theme).toBe('dark');
    expect(normalizeSettings({ fontSize: 'xl' }).fontSize).toBe('medium');
    expect(normalizeSettings({ readingMode: 'blur' }).readingMode).toBe('focus');
    expect(normalizeSettings({ fontFamily: 'cursive' }).fontFamily).toBe('system');
  });
  it('keeps valid values', () => {
    expect(normalizeSettings({ wpm: 450, theme: 'sepia', smartPauses: false, wordsPerTick: 2, readingMode: 'spotlight', fontFamily: 'serif', ttsVoice: 'Google UK English', ttsRate: 1.4, ttsPitch: 0.8 })).toEqual({
      wpm: 450, fontSize: 'medium', theme: 'sepia', smartPauses: false,
      wordsPerTick: 2, readingMode: 'spotlight', fontFamily: 'serif',
      ttsVoice: 'Google UK English', ttsRate: 1.4, ttsPitch: 0.8,
    });
  });
  it('clamps tts rate and pitch, and defaults a non-string voice', () => {
    expect(normalizeSettings({ ttsRate: 9 }).ttsRate).toBe(2);
    expect(normalizeSettings({ ttsRate: 0 }).ttsRate).toBe(0.5);
    expect(normalizeSettings({ ttsPitch: -3 }).ttsPitch).toBe(0);
    expect(normalizeSettings({ ttsVoice: 42 }).ttsVoice).toBe('');
  });
  it('clamps wordsPerTick to 1-8', () => {
    expect(normalizeSettings({ wordsPerTick: 0 }).wordsPerTick).toBe(1);
    expect(normalizeSettings({ wordsPerTick: 50 }).wordsPerTick).toBe(8);
  });
});
