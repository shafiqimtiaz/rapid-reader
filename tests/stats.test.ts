import { describe, it, expect, beforeEach } from 'vitest';
import { aggregate, recordSession, getStats, type DayStats } from '../src/options/stats';

const day = (date: string, words: number, seconds: number): DayStats => ({ date, words, seconds });

function fakeStorage(initial: unknown = {}) {
  let data = structuredClone(initial);
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys: string | string[] | null) => {
          const out: Record<string, unknown> = {};
          const want = Array.isArray(keys) ? keys : keys ? [keys] : Object.keys(data);
          for (const k of want) if (k in data) out[k] = data[k];
          return out;
        },
        set: async (obj: Record<string, unknown>) => { data = { ...data, ...obj }; },
      },
    },
  } as unknown as typeof chrome;
  return () => data;
}

describe('aggregate', () => {
  it('computes totals, avg wpm, and time saved', () => {
    const r = aggregate([day('2026-08-01', 300, 60), day('2026-08-02', 500, 100)]);
    expect(r.totalWords).toBe(800);
    expect(r.totalSeconds).toBe(160);
    expect(r.avgWpm).toBe(300);
    expect(r.timeSavedSeconds).toBeGreaterThan(0);
  });
  it('handles empty input', () => {
    expect(aggregate([])).toEqual({ totalWords: 0, totalSeconds: 0, avgWpm: 0, timeSavedSeconds: 0 });
  });
  it('time saved is never negative', () => {
    const r = aggregate([day('2026-08-01', 10, 1000)]);
    expect(r.timeSavedSeconds).toBe(0);
  });
});

describe('recordSession + getStats', () => {
  beforeEach(() => fakeStorage());

  it('records and aggregates by day', async () => {
    await recordSession(300, 60);
    await recordSession(200, 30);
    const days = await getStats();
    expect(days).toEqual([{ date: expect.any(String), words: 500, seconds: 90 }]);
  });
  it('ignores sessions with zero words', async () => {
    await recordSession(0, 5);
    expect(await getStats()).toEqual([]);
  });
  it('drops days older than 90 days', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 91);
    const oldDate = old.toISOString().slice(0, 10);
    fakeStorage({ 'rr:stats': { days: { [oldDate]: day(oldDate, 100, 60) } } });
    await recordSession(10, 10);
    const days = await getStats();
    expect(days.some((d) => d.date === oldDate)).toBe(false);
  });
});
