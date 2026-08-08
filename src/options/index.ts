import { loadSettings, saveSettings, type Settings } from '../shared/settings';
import { stepWpm, WPM_MAX, WPM_MIN } from '../rsvp/engine';
import { speak } from '../shared/tts';
import { icon } from '../shared/icon';
import {
  Analytics01Icon, BookOpen01Icon, CheckmarkCircle02Icon, Delete02Icon, GaugeIcon, MinusSignIcon,
  PaintBoardIcon, PlayIcon, PlusSignIcon, StopCircleIcon, Timer02Icon, VolumeHighIcon,
} from '@hugeicons/core-free-icons';
import { aggregate, getStats, hasRecentStats, type DayStats } from './stats';

const $ = <T extends Element>(id: string): T => document.getElementById(id) as unknown as T;

const wpmInput = $<HTMLInputElement>('wpm');
const wpmVal = $<HTMLElement>('wpmVal');
const wpmNote = $<HTMLElement>('wpmNote');
const smartCheck = $<HTMLInputElement>('smartPauses');
const wptVal = $<HTMLElement>('wptVal');
const preview = $<HTMLElement>('preview');
const previewWord = $<HTMLElement>('previewWord');
const totals = $<HTMLElement>('totals');
const chart = $<SVGSVGElement>('chart');
const chartEmpty = $<HTMLElement>('chartEmpty');
const resetBtn = $<HTMLButtonElement>('reset');
const saved = $<HTMLElement>('saved');
const ttsSection = $<HTMLElement>('ttsSection');
const ttsVoice = $<HTMLSelectElement>('ttsVoice');
const ttsRate = $<HTMLInputElement>('ttsRate');
const ttsPitch = $<HTMLInputElement>('ttsPitch');
const ttsRateVal = $<HTMLElement>('ttsRateVal');
const ttsPitchVal = $<HTMLElement>('ttsPitchVal');

const TEST_PHRASE = 'Rapid Reader will speak the article in this voice.';

const THEME_BG: Record<Settings['theme'], string> = { dark: '#0f1115', light: '#ffffff', sepia: '#f4ecd8' };
const THEME_FG: Record<Settings['theme'], string> = { dark: '#e7e9ee', light: '#1f2937', sepia: '#3b3226' };

const AVG_WPM = 225;
let currentWpm = 300;

const SECTION_ICONS: Record<string, Parameters<typeof icon>[0]> = {
  reading: BookOpen01Icon,
  pacing: Timer02Icon,
  appearance: PaintBoardIcon,
  aloud: VolumeHighIcon,
  progress: Analytics01Icon,
};

const BUTTON_ICONS: Array<[string, Parameters<typeof icon>[0]]> = [
  ['wpmDown', MinusSignIcon], ['wpmUp', PlusSignIcon],
  ['wptDown', MinusSignIcon], ['wptUp', PlusSignIcon],
  ['ttsTest', PlayIcon], ['ttsStop', StopCircleIcon], ['reset', Delete02Icon],
];

function paintIcons(): void {
  for (const heading of document.querySelectorAll<HTMLElement>('h2[data-icon]')) {
    const name = heading.dataset.icon ?? '';
    const data = SECTION_ICONS[name];
    if (data) heading.insertAdjacentHTML('afterbegin', icon(data, 14));
  }
  for (const [id, data] of BUTTON_ICONS) {
    document.getElementById(id)?.insertAdjacentHTML('afterbegin', icon(data, 16));
  }
  saved.insertAdjacentHTML('afterbegin', icon(CheckmarkCircle02Icon, 14));
  document.querySelector('.stepper .hint b')?.insertAdjacentHTML('afterbegin', icon(GaugeIcon, 15));
}

async function init(): Promise<void> {
  paintIcons();
  const settings = await loadSettings();
  currentWpm = settings.wpm;
  wpmVal.textContent = String(settings.wpm);
  wpmNote.textContent = ratioNote(settings.wpm);
  wpmInput.value = String(settings.wpm);
  smartCheck.checked = settings.smartPauses;
  wptVal.textContent = String(settings.wordsPerTick);
  (document.querySelector(`input[name="readingMode"][value="${settings.readingMode}"]`) as HTMLInputElement).checked = true;
  (document.querySelector(`input[name="fontSize"][value="${settings.fontSize}"]`) as HTMLInputElement).checked = true;
  (document.querySelector(`input[name="fontFamily"][value="${settings.fontFamily}"]`) as HTMLInputElement).checked = true;
  (document.querySelector(`input[name="theme"][value="${settings.theme}"]`) as HTMLInputElement).checked = true;
  applyPreview(settings);
  applyTtsSettings(settings);
  bind();
  await populateVoices(settings.ttsVoice);
  await renderStats();
}

let savedTimer = 0;

/** Every control saves on change; this confirms it landed and reached open readers. */
function flashSaved(): void {
  saved.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { saved.hidden = true; }, 1600) as unknown as number;
}

function applyTtsSettings(s: Settings): void {
  ttsRate.value = String(s.ttsRate);
  ttsPitch.value = String(s.ttsPitch);
  ttsRateVal.textContent = s.ttsRate.toFixed(1);
  ttsPitchVal.textContent = s.ttsPitch.toFixed(1);
}

/** No installed voice means no read-aloud, so the whole section stays out of the page. */
async function populateVoices(selected: string): Promise<void> {
  const voices = await chrome.tts.getVoices();
  ttsSection.hidden = voices.length === 0;
  if (voices.length === 0) return;
  for (const voice of voices) {
    if (!voice.voiceName) continue;
    const option = document.createElement('option');
    option.value = voice.voiceName;
    option.textContent = voice.lang ? `${voice.voiceName} [${voice.lang}]` : voice.voiceName;
    ttsVoice.appendChild(option);
  }
  ttsVoice.value = voices.some((voice) => voice.voiceName === selected) ? selected : '';
}

function bind(): void {
  const update = async (patch: Partial<Settings>): Promise<void> => {
    const next = await loadSettings();
    Object.assign(next, patch);
    await saveSettings(next);
    applyPreview(next);
    flashSaved();
  };
  const onWpmChange = async (wpm: number): Promise<void> => {
    const clamped = Math.min(WPM_MAX, Math.max(WPM_MIN, wpm));
    currentWpm = clamped;
    wpmVal.textContent = String(clamped);
    wpmNote.textContent = ratioNote(clamped);
    wpmInput.value = String(clamped);
    await update({ wpm: clamped });
  };
  $<HTMLButtonElement>('wpmDown').addEventListener('click', () => void onWpmChange(stepWpm(currentWpm, -1)));
  $<HTMLButtonElement>('wpmUp').addEventListener('click', () => void onWpmChange(stepWpm(currentWpm, 1)));
  $<HTMLButtonElement>('wptDown').addEventListener('click', async () => {
    const next = await loadSettings();
    const v = Math.max(1, next.wordsPerTick - 1);
    wptVal.textContent = String(v);
    await update({ wordsPerTick: v });
  });
  $<HTMLButtonElement>('wptUp').addEventListener('click', async () => {
    const next = await loadSettings();
    const v = Math.min(8, next.wordsPerTick + 1);
    wptVal.textContent = String(v);
    await update({ wordsPerTick: v });
  });
  const onChange = (name: string, key: keyof Settings): void => {
    document.querySelectorAll(`input[name="${name}"]`).forEach((el) =>
      el.addEventListener('change', () => void update({ [key]: (el as HTMLInputElement).value } as Partial<Settings>)),
    );
  };
  onChange('readingMode', 'readingMode');
  onChange('fontSize', 'fontSize');
  onChange('fontFamily', 'fontFamily');
  onChange('theme', 'theme');
  smartCheck.addEventListener('change', () => void update({ smartPauses: smartCheck.checked }));
  ttsVoice.addEventListener('change', () => void update({ ttsVoice: ttsVoice.value }));
  ttsRate.addEventListener('input', () => {
    ttsRateVal.textContent = Number(ttsRate.value).toFixed(1);
    void update({ ttsRate: Number(ttsRate.value) });
  });
  ttsPitch.addEventListener('input', () => {
    ttsPitchVal.textContent = Number(ttsPitch.value).toFixed(1);
    void update({ ttsPitch: Number(ttsPitch.value) });
  });
  $<HTMLButtonElement>('ttsTest').addEventListener('click', () =>
    void speak(TEST_PHRASE.split(' '), currentWpm, { onProgress: () => {}, onDone: () => {} }));
  $<HTMLButtonElement>('ttsStop').addEventListener('click', () => chrome.tts.stop());
  resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    await renderStats();
  });
}

function applyPreview(s: Settings): void {
  // The font choice is extension-wide, so the options page wears it too.
  document.body.style.fontFamily = FONT_FAMILY_CSS[s.fontFamily];
  preview.style.background = THEME_BG[s.theme];
  preview.style.color = THEME_FG[s.theme];
  preview.style.fontFamily = FONT_FAMILY_CSS[s.fontFamily];
  preview.style.fontSize = PREVIEW_FONT_SIZES[s.fontSize];
  previewWord.textContent = 'reading speed';
}

const FONT_FAMILY_CSS: Record<Settings['fontFamily'], string> = {
  system: `-apple-system, "Segoe UI", Roboto, sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
  mono: `"SF Mono", "Cascadia Code", Consolas, monospace`,
  rounded: `"Nunito", "Avenir Next", "Segoe UI", sans-serif`,
};

const PREVIEW_FONT_SIZES: Record<Settings['fontSize'], string> = {
  small: '28px',
  medium: '34px',
  large: '42px',
};

function ratioNote(wpm: number): string {
  return `${(wpm / AVG_WPM).toFixed(2)}× faster than average`;
}

async function renderStats(): Promise<void> {
  const days = await getStats();
  const agg = aggregate(days);
  totals.innerHTML = `
    <div class="stat"><div class="num">${agg.totalWords.toLocaleString()}</div><div class="lbl">words read</div></div>
    <div class="stat"><div class="num">${Math.round(agg.totalSeconds / 60)}</div><div class="lbl">minutes</div></div>
    <div class="stat"><div class="num">${agg.avgWpm}</div><div class="lbl">avg wpm</div></div>
    <div class="stat"><div class="num">${Math.round(agg.timeSavedSeconds / 60)}</div><div class="lbl">min saved</div></div>`;
  renderChart(days);
}

function renderChart(days: DayStats[]): void {
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, words: days.find((x) => x.date === key)?.words ?? 0 };
  });
  const max = Math.max(1, ...last14.map((d) => d.words));
  chartEmpty.hidden = hasRecentStats(days);
  const W = 700, H = 120, bw = W / 14;
  chart.innerHTML = last14.map((d, i) => {
    const h = Math.max(2, Math.round((d.words / max) * (H - 10)));
    return `<rect x="${i * bw + bw * 0.15}" y="${H - h}" width="${bw * 0.7}" height="${h}" fill="#818cf8" rx="2"><title>${d.key}: ${d.words} words</title></rect>`;
  }).join('');
}

void init();