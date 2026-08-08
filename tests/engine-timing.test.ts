import { describe, it, expect } from 'vitest';
import { delayFor, applyWpmChange, stepWpm, type Token } from '../src/rsvp/engine';

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
  it('steps by a fixed 25 wpm up and down', () => {
    expect(applyWpmChange({ wpm: 300, smartPauses: true }, 1)).toEqual({ wpm: 325, smartPauses: true });
    expect(applyWpmChange({ wpm: 300, smartPauses: true }, -1)).toEqual({ wpm: 275, smartPauses: true });
  });
  it('returns to the starting speed after up then down', () => {
    const up = applyWpmChange({ wpm: 300, smartPauses: true }, 1);
    expect(applyWpmChange(up, -1).wpm).toBe(300);
  });
  it('snaps off-grid speeds onto the 25 wpm grid', () => {
    expect(stepWpm(310, 1)).toBe(325);
    expect(stepWpm(310, -1)).toBe(275);
  });
  it('clamps at 100 and 1000', () => {
    expect(applyWpmChange({ wpm: 120, smartPauses: true }, -1).wpm).toBe(100);
    expect(applyWpmChange({ wpm: 1000, smartPauses: true }, 1).wpm).toBe(1000);
  });
});
