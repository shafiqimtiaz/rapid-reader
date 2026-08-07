import { describe, it, expect } from 'vitest';
import { pauseMultiplier } from '../src/rsvp/pauses';

describe('pauseMultiplier', () => {
  it('sentence enders are x3', () => {
    for (const c of ['.', '!', '?', '…']) expect(pauseMultiplier(c)).toBe(3);
  });
  it('mid-sentence punctuation is x1.5', () => {
    for (const c of [',', ';', ':', '—']) expect(pauseMultiplier(c)).toBe(1.5);
  });
  it('everything else is x1', () => {
    expect(pauseMultiplier('a')).toBe(1);
    expect(pauseMultiplier('"')).toBe(1);
    expect(pauseMultiplier(undefined)).toBe(1);
  });
});
