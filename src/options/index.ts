import { loadSettings, saveSettings, type Settings } from '../shared/settings';
import { aggregate, getStats } from './stats';

const $ = <T extends Element>(id: string): T => document.getElementById(id) as unknown as T;

const wpmInput = $<HTMLInputElement>('wpm');
const wpmVal = $<HTMLElement>('wpmVal');
const smartCheck = $<HTMLInputElement>('smartPauses');
const preview = $<HTMLElement>('preview');
const totals = $<HTMLElement>('totals');
const chart = $<SVGSVGElement>('chart');
const chartEmpty = $<HTMLElement>('chartEmpty');
const resetBtn = $<HTMLButtonElement>('reset');

const THEME_BG: Record<Settings['theme'], string> = { dark: '#0f1115', light: '#ffffff', sepia: '#f4ecd8' };
const THEME_FG: Record<Settings['theme'], string> = { dark: '#e7e9ee', light: '#1f2937', sepia: '#3b3226' };
const THEME_ANCHOR: Record<Settings['theme'], string> = { dark: '#f87171', light: '#dc2626', sepia: '#b3452a' };

async function init(): Promise<void> {
  const settings = await loadSettings();
  wpmInput.value = String(settings.wpm);
  wpmVal.textContent = `${settings.wpm} wpm`;
  smartCheck.checked = settings.smartPauses;
  const fs = document.querySelector(`input[name="fontSize"][value="${settings.fontSize}"]`) as HTMLInputElement;
  const th = document.querySelector(`input[name="theme"][value="${settings.theme}"]`) as HTMLInputElement;
  fs.checked = true;
  th.checked = true;
  applyPreview(settings);
  bind();
  await renderStats();
}

function bind(): void {
  const update = async (patch: Partial<Settings>): Promise<void> => {
    const next = await loadSettings();
    Object.assign(next, patch);
    await saveSettings(next);
    applyPreview(next);
  };
  wpmInput.addEventListener('input', () => {
    wpmVal.textContent = `${wpmInput.value} wpm`;
    void update({ wpm: Number(wpmInput.value) });
  });
  document.querySelectorAll('input[name="fontSize"]').forEach((el) =>
    el.addEventListener('change', () => void update({ fontSize: (el as HTMLInputElement).value as Settings['fontSize'] })),
  );
  document.querySelectorAll('input[name="theme"]').forEach((el) =>
    el.addEventListener('change', () => void update({ theme: (el as HTMLInputElement).value as Settings['theme'] })),
  );
  smartCheck.addEventListener('change', () => void update({ smartPauses: smartCheck.checked }));
  resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    await renderStats();
  });
}

function applyPreview(s: Settings): void {
  preview.style.background = THEME_BG[s.theme];
  preview.style.color = THEME_FG[s.theme];
  const anchor = preview.querySelector('.anchor') as HTMLElement;
  anchor.style.color = THEME_ANCHOR[s.theme];
}

async function renderStats(): Promise<void> {
  const days = await getStats();
  const agg = aggregate(days);
  totals.innerHTML = `
    <div class="stat"><div class="num">${agg.totalWords.toLocaleString()}</div><div class="lbl">words read</div></div>
    <div class="stat"><div class="num">${Math.round(agg.totalSeconds / 60)}</div><div class="lbl">minutes</div></div>
    <div class="stat"><div class="num">${agg.avgWpm}</div><div class="lbl">avg wpm</div></div>
    <div class="stat"><div class="num">${Math.round(agg.timeSavedSeconds / 60)}</div><div class="lbl">min saved vs 240wpm</div></div>`;
  renderChart(days);
}

function renderChart(days: { date: string; words: number }[]): void {
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, words: days.find((x) => x.date === key)?.words ?? 0 };
  });
  const max = Math.max(1, ...last14.map((d) => d.words));
  chartEmpty.hidden = last14.every((d) => d.words === 0);
  const W = 700, H = 120, bw = W / 14;
  chart.innerHTML = last14.map((d, i) => {
    const h = Math.max(2, Math.round((d.words / max) * (H - 10)));
    return `<rect x="${i * bw + bw * 0.15}" y="${H - h}" width="${bw * 0.7}" height="${h}" fill="#818cf8" rx="2"><title>${d.key}: ${d.words} words</title></rect>`;
  }).join('');
}

void init();
