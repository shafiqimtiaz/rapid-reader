import { applyWpmChange, delayFor, sentenceStart, type Token } from '../rsvp/engine';
import type { Settings, Theme, FontFamily } from '../shared/settings';
import { MSG_OPEN_OPTIONS, MSG_SPEAK, MSG_SPEAK_STOP, MSG_TTS_CHECK, type SpeakMessage, type TtsCheckMessage, type TtsCheckReply } from '../shared/messages';
import { icon } from '../shared/icon';
import { utterances, wordAtChar, type Utterance } from '../shared/tts';
import {
  Backward01Icon, Cancel01Icon, Forward01Icon, MinusSignIcon, PauseIcon, PlayIcon, PlusSignIcon,
  Settings01Icon, VolumeHighIcon, VolumeMute02Icon,
} from '@hugeicons/core-free-icons';

interface OverlayCallbacks {
  onClose: () => void;
  onStats: (words: number, seconds: number) => void;
}

const THEMES: Record<Theme, { bg: string; word: string; control: string; accent: string }> = {
  dark: { bg: '#0f1115', word: '#e7e9ee', control: '#9ca3af', accent: '#818cf8' },
  light: { bg: '#ffffff', word: '#1f2937', control: '#6b7280', accent: '#4f46e5' },
  sepia: { bg: '#f4ecd8', word: '#3b3226', control: '#8a7a5f', accent: '#a8763e' },
};

const FONT_SIZES: Record<Settings['fontSize'], string> = {
  small: 'clamp(28px, 5vw, 48px)',
  medium: 'clamp(36px, 7vw, 64px)',
  large: 'clamp(48px, 9vw, 88px)',
};

const FONT_FAMILIES: Record<FontFamily, string> = {
  system: `-apple-system, "Segoe UI", Roboto, sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
  mono: `"SF Mono", "Cascadia Code", Consolas, monospace`,
  rounded: `"Nunito", "Avenir Next", "Segoe UI", sans-serif`,
};

/** Held arrow keys scrub silently; the voice only restarts once the position settles. */
const SEEK_DEBOUNCE_MS = 250;
/** Some engines never emit word events — after this long the ticker takes over pacing. */
const WORD_EVENT_GRACE_MS = 1500;

/** Wider chunks get smaller type so the whole group still fits on one line. */
function chunkScale(wordsPerTick: number): number {
  if (wordsPerTick <= 1) return 1;
  return Math.round(Math.max(0.42, 1 / Math.sqrt(wordsPerTick)) * 100) / 100;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export class Overlay {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private wordEl: HTMLElement | null = null;
  private metaEl: HTMLElement | null = null;
  private playBtn: HTMLElement | null = null;
  private aloudBtn: HTMLElement | null = null;
  private tokens: Token[] = [];
  private index = 0;
  private playing = false;
  private aloud = false;
  private speechExpected = false;
  private watchdog = 0;
  private seekTimer = 0;
  private ttsAvailable = false;
  private utterances: Utterance[] = [];
  private spokenTokens: number[] = [];
  private rafId = 0;
  private flowFrameId = 0;
  private nextAt = 0;
  private startedAt = 0;
  private wordsDone = 0;
  private statsSent = false;
  private settings: Settings;
  private callbacks: OverlayCallbacks;

  constructor(settings: Settings, callbacks: OverlayCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
  }

  mount(): void {
    if (this.host) return;
    this.host = document.createElement('div');
    this.host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    this.root = this.host.attachShadow({ mode: 'open' });
    this.root.innerHTML = this.html();
    this.wordEl = this.root.querySelector('.word') as HTMLElement;
    this.metaEl = this.root.querySelector('.meta') as HTMLElement;
    this.playBtn = this.root.querySelector('[data-action="pause"]') as HTMLElement | null;
    this.aloudBtn = this.root.querySelector('[data-action="aloud"]') as HTMLElement | null;
    this.applyTheme();
    this.bindKeys();
    this.bindControls();
    document.documentElement.appendChild(this.host);
    void this.revealAloudIfSupported();
  }

  /** The Aloud button stays hidden unless the browser actually has a voice installed. */
  private async revealAloudIfSupported(): Promise<void> {
    const reply = await chrome.runtime.sendMessage({ type: MSG_TTS_CHECK } satisfies TtsCheckMessage) as TtsCheckReply | undefined;
    this.ttsAvailable = reply?.available === true;
    if (this.aloudBtn) this.aloudBtn.hidden = !this.ttsAvailable;
  }

  unmount(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.flowFrameId) cancelAnimationFrame(this.flowFrameId);
    this.stopSpeech();
    this.playing = false;
    this.host?.remove();
    this.host = null;
    this.root = null;
    if (!this.statsSent && this.wordsDone > 0) {
      this.statsSent = true;
      const seconds = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
      this.callbacks.onStats(this.wordsDone, seconds);
    }
  }

  start(tokens: Token[], wpm: number, startIndex = 0): void {
    this.tokens = tokens;
    this.index = Math.min(tokens.length - 1, Math.max(0, startIndex));
    this.wordsDone = 0;
    this.statsSent = false;
    this.startedAt = 0;
    this.settings = { ...this.settings, wpm };
    this.render();
    this.updateMeta();
    this.pause();
  }

  pause(): void {
    this.playing = false;
    this.stopTicker();
    this.stopSpeech();
    this.updatePlayBtn();
    this.updateMeta();
  }

  /** Play is the only transport: it starts the voice when Aloud is on, the ticker otherwise. */
  resume(): void {
    if (this.playing || this.tokens.length === 0) return;
    this.playing = true;
    if (!this.startedAt) this.startedAt = Date.now();
    this.updatePlayBtn();
    this.updateMeta();
    if (this.aloud) {
      this.startSpeech();
      return;
    }
    this.startTicker();
  }

  private stopTicker(): void {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
  }

  private startTicker(): void {
    this.stopTicker();
    this.nextAt = performance.now() + delayFor(this.tokens[this.index]!, this.settings.wpm, this.settings.smartPauses);
    const tick = (now: number) => {
      if (!this.playing) return;
      while (now >= this.nextAt && this.playing) {
        this.wordsDone += this.visibleCount();
        this.index += this.settings.wordsPerTick;
        if (this.index >= this.tokens.length) { this.finish(); return; }
        this.render();
        this.updateMeta();
        this.nextAt += delayFor(this.tokens[this.index]!, this.settings.wpm, this.settings.smartPauses);
      }
      if (this.playing) this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  step(delta: number): void {
    this.index = Math.min(this.tokens.length - 1, Math.max(0, this.index + delta));
    this.render();
    this.updateMeta();
    this.reseekSpeech();
  }

  skip(delta: number): void { this.step(delta); }
  setSpeed(wpm: number): void {
    this.settings = { ...this.settings, wpm };
    if (this.playing && !this.aloud) { this.startTicker(); }
    // Speech rate is derived from wpm, so the utterance queue has to be rebuilt.
    this.reseekSpeech();
    this.updateMeta();
  }
  updateSettings(s: Settings): void {
    this.settings = s;
    this.applyTheme();
    if (this.tokens.length === 0) return;
    this.render();
    this.updateMeta();
  }

  /** Arms or disarms read-aloud. Nothing is spoken until Play; nothing stops but the voice. */
  toggleAloud(): void {
    this.aloud = !this.aloud;
    this.updateAloudBtn();
    if (!this.aloud) {
      this.stopSpeech();
      // The voice was the clock, so hand pacing back to the ticker.
      if (this.playing) this.startTicker();
      return;
    }
    if (this.playing) {
      this.stopTicker();
      this.startSpeech();
    }
  }

  /** Moves the reader onto the word the voice is currently saying. */
  onSpeakProgress(utteranceIndex: number, charIndex: number): void {
    const utterance = this.utterances[utteranceIndex];
    if (!utterance || !this.speechExpected) return;
    this.clearWatchdog();
    const spoken = utterance.startWord + wordAtChar(utterance, charIndex);
    const token = this.spokenTokens[spoken];
    if (token == null) return;
    this.wordsDone += Math.max(0, token - this.index);
    this.index = token;
    this.render();
    this.updateMeta();
  }

  /** The service worker reporting that speech stopped, for whatever reason. */
  onSpeakState(speaking: boolean, reason?: string): void {
    if (speaking || !this.speechExpected) return;
    this.speechExpected = false;
    this.clearWatchdog();
    if (reason && this.metaEl) this.metaEl.textContent = reason;
    if (!this.playing) return;
    if (this.index >= this.tokens.length - 1) { this.finish(); return; }
    // Speech died early (engine error, no voice). Keep reading visually.
    this.startTicker();
  }

  /** Rebuilds the utterance queue from the current sentence; debounced for held keys. */
  private reseekSpeech(): void {
    if (!this.playing || !this.aloud) return;
    this.stopSpeech();
    clearTimeout(this.seekTimer);
    this.seekTimer = setTimeout(() => this.startSpeech(), SEEK_DEBOUNCE_MS) as unknown as number;
  }

  private startSpeech(): void {
    clearTimeout(this.seekTimer);
    this.index = sentenceStart(this.tokens, this.index);
    // Paragraph-break tokens are dropped for speech, so keep a map back to the reader.
    const spokenTokens: number[] = [];
    const words: string[] = [];
    for (let i = this.index; i < this.tokens.length; i++) {
      if (this.tokens[i]!.text === '') continue;
      spokenTokens.push(i);
      words.push(this.tokens[i]!.text);
    }
    if (words.length === 0) { this.finish(); return; }
    this.spokenTokens = spokenTokens;
    this.utterances = utterances(words);
    this.render();
    this.updateMeta();
    this.speechExpected = true;
    void chrome.runtime.sendMessage({ type: MSG_SPEAK, words, wpm: this.settings.wpm } satisfies SpeakMessage);
    // Some engines never emit word events; fall back to the ticker rather than freeze.
    this.watchdog = setTimeout(() => {
      if (this.playing && this.speechExpected) this.startTicker();
    }, WORD_EVENT_GRACE_MS) as unknown as number;
  }

  private stopSpeech(): void {
    this.clearWatchdog();
    clearTimeout(this.seekTimer);
    if (!this.speechExpected) return;
    this.speechExpected = false;
    void chrome.runtime.sendMessage({ type: MSG_SPEAK_STOP });
  }

  private clearWatchdog(): void {
    clearTimeout(this.watchdog);
    this.watchdog = 0;
  }

  private updateAloudBtn(): void {
    if (!this.aloudBtn) return;
    this.aloudBtn.innerHTML = this.aloud
      ? `${icon(VolumeHighIcon)}<span>Aloud</span>`
      : `${icon(VolumeMute02Icon)}<span>Aloud</span>`;
    this.aloudBtn.setAttribute('aria-pressed', String(this.aloud));
    this.aloudBtn.classList.toggle('on', this.aloud);
  }

  showEmpty(): void { this.renderState('No readable text found.', ''); }
  showError(message: string): void { this.renderState('Something went wrong.', message); }

  private finish(): void {
    this.playing = false;
    this.updatePlayBtn();
    this.renderState('Finished', `${this.wordsDone} words · press Esc to close`);
  }

  private updatePlayBtn(): void {
    if (!this.playBtn) return;
    this.playBtn.innerHTML = this.playing
      ? `${icon(PauseIcon)}<span>Pause</span>`
      : `${icon(PlayIcon)}<span>Play</span>`;
  }

  private render(): void {
    if (!this.wordEl) return;
    const parts: string[] = [];
    for (let i = 0; i < this.settings.wordsPerTick; i++) {
      const token = this.tokens[this.index + i];
      if (!token) break;
      parts.push(token.text === '' ? '¶' : token.text);
    }
    this.wordEl.classList.toggle('chunk', this.settings.wordsPerTick > 1);
    this.wordEl.textContent = parts.join(' ');
    if (this.settings.readingMode === 'flow') this.restartFlowAnimation();
  }

  private restartFlowAnimation(): void {
    const word = this.wordEl;
    if (!word) return;
    if (this.flowFrameId) cancelAnimationFrame(this.flowFrameId);
    word.classList.remove('flow-in');
    this.flowFrameId = requestAnimationFrame(() => {
      this.flowFrameId = 0;
      if (this.wordEl === word) word.classList.add('flow-in');
    });
  }

  private visibleCount(): number {
    return Math.min(this.settings.wordsPerTick, this.tokens.length - this.index);
  }

  private renderState(title: string, sub: string): void {
    if (this.wordEl) this.wordEl.textContent = title;
    if (this.metaEl) this.metaEl.textContent = sub;
  }

  private updateMeta(): void {
    if (!this.metaEl) return;
    const total = this.tokens.length;
    const pct = total > 0 ? Math.round((this.index / total) * 100) : 0;
    const state = this.playing ? '▶' : '⏸';
    this.metaEl.textContent = `${state} ${this.index + 1}/${total} (${pct}%) · ${this.settings.wpm} wpm`;
  }

  private bindKeys(): void {
    document.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    switch (e.key) {
      case ' ': e.preventDefault(); if (this.playing) this.pause(); else this.resume(); break;
      case 'ArrowLeft': e.preventDefault(); this.step(-1); break;
      case 'ArrowRight': e.preventDefault(); this.step(1); break;
      case 'ArrowUp': e.preventDefault(); this.setSpeed(applyWpmChange(this.settings, 1).wpm); break;
      case 'ArrowDown': e.preventDefault(); this.setSpeed(applyWpmChange(this.settings, -1).wpm); break;
      case '[': e.preventDefault(); this.skip(-10); break;
      case ']': e.preventDefault(); this.skip(10); break;
      case 'Escape': e.preventDefault(); this.callbacks.onClose(); break;
    }
  };

  private bindControls(): void {
    this.root?.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'pause') { if (this.playing) this.pause(); else this.resume(); }
        else if (action === 'back') this.skip(-10);
        else if (action === 'forward') this.skip(10);
        else if (action === 'slower') this.setSpeed(applyWpmChange(this.settings, -1).wpm);
        else if (action === 'faster') this.setSpeed(applyWpmChange(this.settings, 1).wpm);
        else if (action === 'aloud') this.toggleAloud();
        else if (action === 'settings') this.openSettings();
        else if (action === 'close') this.callbacks.onClose();
      });
    });
  }

  private openSettings(): void {
    void chrome.runtime.sendMessage({ type: MSG_OPEN_OPTIONS });
  }

  private applyTheme(): void {
    const t = THEMES[this.settings.theme];
    const host = this.host;
    if (!host) return;
    // The host carries `all: initial` inline, which outranks any :host rule, so the
    // font has to be set inline for the whole shadow tree to inherit it.
    host.style.fontFamily = FONT_FAMILIES[this.settings.fontFamily];
    host.style.background = withAlpha(t.bg, 0.64);
    host.style.backdropFilter = 'blur(24px) saturate(1.6)';
    host.style.setProperty('-webkit-backdrop-filter', 'blur(24px) saturate(1.6)');
    const stage = this.root?.querySelector('.stage') as HTMLElement | null;
    if (stage) { stage.className = 'stage'; stage.classList.add(this.settings.readingMode); }
    const style = this.root?.querySelector('style') as HTMLStyleElement | null;
    if (style) {
      style.textContent = `
        /* One font for the whole reader: stage, meta, control bar and close button. */
        :host { all: initial; font-family: ${FONT_FAMILIES[this.settings.fontFamily]}; }
        .stage, .bar, .bar button, .close, .meta { font-family: inherit; }
        .stage { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 38vh; }
        .stage.focus .word { }
        /* Full width so the box never resizes between words — a shrinking box under an
           animation re-centers every tick, which reads as horizontal shake. */
        .stage.flow .word { width: 100%; opacity: 1; will-change: transform, opacity; }
        .stage.spotlight .word { }
        .word { font-size: ${FONT_SIZES[this.settings.fontSize]}; font-weight: 600; color: ${t.word}; letter-spacing: 0.02em; line-height: 1.15; min-height: 1.2em; text-align: center; padding: 0 6vw; max-width: 88vw; overflow-wrap: break-word; text-wrap: balance; }
        .word.chunk { font-size: calc(${FONT_SIZES[this.settings.fontSize]} * ${chunkScale(this.settings.wordsPerTick)}); letter-spacing: 0.01em; }
        .stage.spotlight .word { background: ${withAlpha(t.bg, 0.78)}; box-shadow: 0 14px 38px ${withAlpha(t.bg, 0.22)}; padding: 22px 34px; border-radius: 18px; }
        .stage.flow .word.flow-in { animation: rr-flow-in 0.24s cubic-bezier(0.22, 1, 0.36, 1) both; }
        /* Vertical rise only: horizontal motion fights the centered word and jitters. */
        @keyframes rr-flow-in { from { transform: translate3d(0, 6px, 0); opacity: 0.35; } to { transform: translate3d(0, 0, 0); opacity: 1; } }
        .meta { margin-top: 1rem; font-size: 13px; color: ${t.control}; letter-spacing: 0.08em; text-transform: uppercase; background: ${t.bg}; padding: 8px 16px; border-radius: 999px; }
        .bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-radius: 14px; background: ${t.bg}; box-shadow: 0 8px 30px rgba(0,0,0,0.35); border: 1px solid ${t.accent}33; }
        .bar button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: ${t.control}; font-size: 14px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .icon { flex: none; display: block; }
        .bar button:hover { background: ${t.accent}33; color: ${t.accent}; }
        .bar button.on { color: ${t.accent}; background: ${withAlpha(t.accent, 0.16)}; }
        .bar .primary { color: ${t.accent}; font-weight: 600; min-width: 96px; text-align: center; }
        .close { display: inline-flex; align-items: center; gap: 6px; position: fixed; z-index: 3; top: 18px; right: 18px; appearance: none; border: 1px solid ${t.accent}55; background: ${withAlpha(t.bg, 0.9)}; color: ${t.control}; font-size: 13px; font-weight: 500; line-height: 1.2; padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease; }
        .close:hover { border-color: ${t.accent}; background: ${withAlpha(t.accent, 0.15)}; color: ${t.accent}; }
        .close:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
        .stage[hidden], .bar[hidden], .bar button[hidden] { display: none !important; }
      `;
    }
  }

  private html(): string {
    return `
      <style></style>
      <button data-action="close" class="close">${icon(Cancel01Icon, 15)}<span>Close</span></button>
      <div class="stage"><div class="word"></div><div class="meta"></div></div>
      <div class="bar">
        <button data-action="back" title="Back 10 words">${icon(Backward01Icon)}<span>10</span></button>
        <button class="primary" data-action="pause">${icon(PlayIcon)}<span>Play</span></button>
        <button data-action="forward" title="Forward 10 words">${icon(Forward01Icon)}<span>10</span></button>
        <button data-action="slower" title="Slower">${icon(MinusSignIcon)}<span>Speed</span></button>
        <button data-action="faster" title="Faster">${icon(PlusSignIcon)}<span>Speed</span></button>
        <button data-action="aloud" aria-pressed="false" title="Read aloud — takes effect on Play" hidden>${icon(VolumeMute02Icon)}<span>Aloud</span></button>
        <button data-action="settings" title="Settings">${icon(Settings01Icon)}<span>Settings</span></button>
      </div>`;
  }
}
