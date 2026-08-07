import { describe, it, expect } from 'vitest';
import { fixationIndex } from '../src/rsvp/fixation';

describe('fixationIndex', () => {
  it('middle for 1-2 chars', () => {
    expect(fixationIndex(1)).toBe(0);
    expect(fixationIndex(2)).toBe(1);
  });
  it('2nd from right for 3-6 chars', () => {
    expect(fixationIndex(3)).toBe(1);
    expect(fixationIndex(4)).toBe(2);
    expect(fixationIndex(5)).toBe(3);
    expect(fixationIndex(6)).toBe(4);
  });
  it('3rd from right for 7-9 chars', () => {
    expect(fixationIndex(7)).toBe(4);
    expect(fixationIndex(8)).toBe(5);
    expect(fixationIndex(9)).toBe(6);
  });
  it('4th from right for 10+ chars, clamped', () => {
    expect(fixationIndex(10)).toBe(6);
    expect(fixationIndex(12)).toBe(8);
    expect(fixationIndex(40)).toBe(36);
  });
  it('never out of range', () => {
    for (let len = 1; len <= 100; len++) {
      const i = fixationIndex(len);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(len);
    }
  });
});
