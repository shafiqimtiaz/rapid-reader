export type FontSize = 'small' | 'medium' | 'large';
export type Theme = 'dark' | 'light' | 'sepia';

export interface Settings {
  wpm: number;
  fontSize: FontSize;
  theme: Theme;
  smartPauses: boolean;
}

export const DEFAULT_SETTINGS: Settings = { wpm: 300, fontSize: 'medium', theme: 'dark', smartPauses: true };

const FONT_SIZES: FontSize[] = ['small', 'medium', 'large'];
const THEMES: Theme[] = ['dark', 'light', 'sepia'];

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const wpm = typeof r.wpm === 'number' ? Math.min(1000, Math.max(100, Math.round(r.wpm))) : DEFAULT_SETTINGS.wpm;
  const fontSize = FONT_SIZES.includes(r.fontSize as FontSize) ? (r.fontSize as FontSize) : DEFAULT_SETTINGS.fontSize;
  const theme = THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_SETTINGS.theme;
  const smartPauses = typeof r.smartPauses === 'boolean' ? r.smartPauses : DEFAULT_SETTINGS.smartPauses;
  return { wpm, fontSize, theme, smartPauses };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get('rr:settings');
  return normalizeSettings(stored['rr:settings']);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ 'rr:settings': settings });
}
