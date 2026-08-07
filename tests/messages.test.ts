import { describe, it, expect } from 'vitest';
import { MSG_START, MSG_STOP, MSG_STATS, MSG_SETTINGS } from '../src/shared/messages';

describe('message constants', () => {
  it('all constants are distinct non-empty strings', () => {
    const all = [MSG_START, MSG_STOP, MSG_STATS, MSG_SETTINGS];
    expect(new Set(all).size).toBe(4);
    for (const m of all) expect(m.length).toBeGreaterThan(0);
  });
});
