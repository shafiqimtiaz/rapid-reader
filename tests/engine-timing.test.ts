import { describe, it, expect } from 'vitest';
import { delayFor, applyWpmChange, type Token } from '../src/rsvp/engine';

const word = (text: string, pauseAfter = 1): Token => ({ text, pauseAfter });

describe('delayFor', () => {
  it('base delay is 60000/wpm', () => {
    expect(delayFor(word('cat'), 300, true)).toBeCloseTo(200);
    expect(delayFor(word('cat'), 600, true)).toBeCloseTo(100);
  });
  it('applies pause multiplier when smartPauses on', () => {
    expect(delayFor(word('cat.', 3), 300, true)).toBeCloseTo(600);
  });
  it('ignores pauses when smartPauses off', () => {
    expect(delayFor(word('cat.', 3), 300, false)).toBeCloseTo(200);
  });
  it('long words get 1.25x when smartPauses on', () => {
    expect(delayFor(word('extraordinarily'), 300, true)).toBeCloseTo(250);
  });
  it('paragraph pause is x5', () => {
    expect(delayFor(word('', 5), 300, true)).toBeCloseTo(1000);
  });
});

describe('applyWpmChange', () => {
  it('steps 20% up and down', () => {
    expect(applyWpmChange({ wpm: 300, smartPauses: true }, 1)).toEqual({ wpm: 360, smartPauses: true });
    expect(applyWpmChange({ wpm: 300, smartPauses: true }, -1)).toEqual({ wpm: 240, smartPauses: true });
  });
  it('clamps at 100 and 1000', () => {
    expect(applyWpmChange({ wpm: 120, smartPauses: true }, -1).wpm).toBe(100);
    expect(applyWpmChange({ wpm: 900, smartPauses: true }, 1).wpm).toBe(1000);
  });
});
