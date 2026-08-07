export interface DayStats {
  date: string;
  words: number;
  seconds: number;
}

export interface Aggregate {
  totalWords: number;
  totalSeconds: number;
  avgWpm: number;
  timeSavedSeconds: number;
}

const KEY = 'rr:stats';
const KEEP_DAYS = 90;

export function aggregate(days: DayStats[]): Aggregate {
  const totalWords = days.reduce((s, d) => s + d.words, 0);
  const totalSeconds = days.reduce((s, d) => s + d.seconds, 0);
  const avgWpm = totalSeconds > 0 ? Math.round(totalWords / (totalSeconds / 60)) : 0;
  const baseline = (totalWords / 240) * 60;
  const timeSavedSeconds = Math.max(0, Math.round(baseline - totalSeconds));
  return { totalWords, totalSeconds, avgWpm, timeSavedSeconds };
}

export async function recordSession(words: number, seconds: number): Promise<void> {
  if (words < 1) return;
  const stored = await chrome.storage.local.get(KEY);
  const days = (stored[KEY]?.days ?? {}) as Record<string, DayStats>;
  const today = new Date().toISOString().slice(0, 10);
  const prev = days[today] ?? { date: today, words: 0, seconds: 0 };
  days[today] = { date: today, words: prev.words + words, seconds: prev.seconds + seconds };

  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  for (const date of Object.keys(days)) {
    if (new Date(date + 'T00:00:00').getTime() < cutoff) delete days[date];
  }
  await chrome.storage.local.set({ [KEY]: { days } });
}

export async function getStats(): Promise<DayStats[]> {
  const stored = await chrome.storage.local.get(KEY);
  const days = (stored[KEY]?.days ?? {}) as Record<string, DayStats>;
  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
}
