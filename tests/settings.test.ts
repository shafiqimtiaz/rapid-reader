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
  });
  it('keeps valid values', () => {
    expect(normalizeSettings({ wpm: 450, theme: 'sepia', smartPauses: false })).toEqual({
      wpm: 450, fontSize: 'medium', theme: 'sepia', smartPauses: false,
    });
  });
});
