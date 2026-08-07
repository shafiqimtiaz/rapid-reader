import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/rsvp/engine';

describe('tokenize', () => {
  it('splits words and maps sentence-ender pause', () => {
    expect(tokenize('Hello world.')).toEqual([
      { text: 'Hello', pauseAfter: 1 },
      { text: 'world.', pauseAfter: 3 },
    ]);
  });
  it('maps comma to x1.5', () => {
    expect(tokenize('a, b')).toEqual([
      { text: 'a,', pauseAfter: 1.5 },
      { text: 'b', pauseAfter: 1 },
    ]);
  });
  it('keeps URLs atomic', () => {
    const t = tokenize('see https://example.com/path?a=b now');
    expect(t[1]!.text).toBe('https://example.com/path?a=b');
    expect(t[1]!.pauseAfter).toBe(1);
  });
  it('keeps numbers atomic', () => {
    const t = tokenize('costs 1,234.56 dollars');
    expect(t[1]!.text).toBe('1,234.56');
    expect(t[1]!.pauseAfter).toBe(1);
  });
  it('keeps hyphenated words as one token', () => {
    expect(tokenize('well-known')).toEqual([{ text: 'well-known', pauseAfter: 1 }]);
  });
  it('strips leading quotes and parens', () => {
    expect(tokenize('"quote" starts')).toEqual([
      { text: 'quote"', pauseAfter: 1 },
      { text: 'starts', pauseAfter: 1 },
    ]);
  });
  it('handles trailing quote after sentence ender', () => {
    expect(tokenize('said she."')).toEqual([
      { text: 'said', pauseAfter: 1 },
      { text: 'she."', pauseAfter: 3 },
    ]);
  });
  it('paragraph break gives x5', () => {
    const t = tokenize('one.\n\ntwo.');
    expect(t[1]).toEqual({ text: '', pauseAfter: 5 });
    expect(t).toHaveLength(4);
  });
  it('drops pure-punctuation tokens', () => {
    expect(tokenize('a -- b')).toEqual([
      { text: 'a', pauseAfter: 1 },
      { text: '--', pauseAfter: 1.5 },
      { text: 'b', pauseAfter: 1 },
    ]);
  });
  it('normalizes nbsp to space', () => {
    expect(tokenize('a\u00a0b')).toEqual([
      { text: 'a', pauseAfter: 1 },
      { text: 'b', pauseAfter: 1 },
    ]);
  });
});
