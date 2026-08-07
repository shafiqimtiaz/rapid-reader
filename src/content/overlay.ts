import { fixationIndex } from '../rsvp/fixation';
import { applyWpmChange, delayFor, type Token } from '../rsvp/engine';
import type { Settings, Theme } from '../shared/settings';

interface OverlayCallbacks {
  onClose: () => void;
  onStats: (words: number, seconds: number) => void;
}

const THEMES: Record<Theme, { bg: string; word: string; anchor: string; dim: string; control: string; accent: string }> = {
  dark: { bg: '#0f1115', word: '#e7e9ee', anchor: '#f87171', dim: 'rgba(0,0,0,0.55)', control: '#9ca3af', accent: '#818cf8' },
  light: { bg: '#ffffff', word: '#1f2937', anchor: '#dc2626', dim: 'rgba(0,0,0,0.25)', control: '#6b7280', accent: '#4f46e5' },
  sepia: { bg: '#f4ecd8', word: '#3b3226', anchor: '#b3452a', dim: 'rgba(0,0,0,0.35)', control: '#8a7a5f', accent: '#a8763e' },
};

const FONT_SIZES: Record<Settings['fontSize'], string> = {
  small: 'clamp(28px, 5vw, 48px)',
  medium: 'clamp(36px, 7vw, 64px)',
  large: 'clamp(48px, 9vw, 88px)',
};

export class Overlay {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private wordEl: HTMLElement | null = null;
  private metaEl: HTMLElement | null = null;
  private tokens: Token[] = [];
  private index = 0;
  private playing = false;
  private rafId = 0;
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
    this.applyTheme();
    this.bindKeys();
    this.bindControls();
    document.documentElement.appendChild(this.host);
  }

  unmount(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
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

  start(tokens: Token[], wpm: number): void {
    this.tokens = tokens;
    this.index = 0;
    this.wordsDone = 0;
    this.statsSent = false;
    this.startedAt = 0;
    this.settings = { ...this.settings, wpm };
    this.render();
    this.updateMeta();
    this.pause();
  }

  pause(): void { this.playing = false; if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; } this.updateMeta(); }
  resume(): void {
    if (this.playing || this.tokens.length === 0) return;
    this.playing = true;
    if (!this.startedAt) this.startedAt = Date.now();
    this.nextAt = performance.now() + delayFor(this.tokens[this.index]!, this.settings.wpm, this.settings.smartPauses);
    const tick = (now: number) => {
      if (!this.playing) return;
      while (now >= this.nextAt && this.playing) {
        this.wordsDone++;
        this.index++;
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
  }

  skip(delta: number): void { this.step(delta); }
  setSpeed(wpm: number): void { this.settings = { ...this.settings, wpm }; if (this.playing) { this.pause(); this.resume(); } this.updateMeta(); }
  updateSettings(s: Settings): void { this.settings = s; this.applyTheme(); }

  showEmpty(): void { this.renderState('No readable text found.', ''); }
  showError(message: string): void { this.renderState('Something went wrong.', message); }

  private finish(): void {
    this.playing = false;
    this.renderState('Finished', `${this.wordsDone} words · press Esc to close`);
  }

  private render(): void {
    const token = this.tokens[this.index];
    if (!token || !this.wordEl) return;
    if (token.text === '') { this.wordEl.textContent = '¶'; return; }
    const idx = Math.min(fixationIndex(token.text.length), token.text.length - 1);
    const before = token.text.slice(0, idx);
    const anchor = token.text.slice(idx, idx + 1);
    const after = token.text.slice(idx + 1);
    this.wordEl.innerHTML = '';
    const b = document.createElement('span');
    b.textContent = before;
    const a = document.createElement('span');
    a.className = 'anchor';
    a.textContent = anchor;
    const af = document.createElement('span');
    af.textContent = after;
    this.wordEl.append(b, a, af);
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
        else if (action === 'close') this.callbacks.onClose();
      });
    });
  }

  private applyTheme(): void {
    const t = THEMES[this.settings.theme];
    const host = this.host;
    if (!host) return;
    host.style.background = t.dim;
    const style = this.root?.querySelector('style') as HTMLStyleElement | null;
    if (style) {
      style.textContent = `
        :host { all: initial; }
        .stage { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 38vh; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
        .word { font-size: ${FONT_SIZES[this.settings.fontSize]}; font-weight: 600; color: ${t.word}; letter-spacing: 0.02em; min-height: 1.2em; text-align: center; padding: 0 6vw; }
        .anchor { color: ${t.anchor}; }
        .meta { margin-top: 1rem; font-size: 13px; color: ${t.control}; letter-spacing: 0.08em; text-transform: uppercase; }
        .bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; padding: 8px 12px; border-radius: 12px; background: ${t.bg}; box-shadow: 0 8px 30px rgba(0,0,0,0.35); opacity: 0.25; transition: opacity 0.2s; }
        .bar:hover { opacity: 1; }
        .bar button { border: 0; background: transparent; color: ${t.control}; font-size: 15px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .bar button:hover { background: ${t.accent}22; color: ${t.accent}; }
      `;
    }
  }

  private html(): string {
    return `
      <style></style>
      <div class="stage"><div class="word"></div><div class="meta"></div></div>
      <div class="bar">
        <button data-action="back">« −10</button>
        <button data-action="pause">⏯ Pause</button>
        <button data-action="forward">+10 »</button>
        <button data-action="slower">− Speed</button>
        <button data-action="faster">+ Speed</button>
        <button data-action="close">✕ Close</button>
      </div>`;
  }
}
