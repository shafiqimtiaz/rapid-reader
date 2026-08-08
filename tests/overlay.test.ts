// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Overlay } from '../src/content/overlay';
import { tokenize } from '../src/rsvp/engine';
import { MSG_OPEN_OPTIONS, MSG_SPEAK, MSG_SPEAK_STOP, MSG_TTS_CHECK } from '../src/shared/messages';
function env() {
  const d = new JSDOM('<!DOCTYPE html><html><body><div id="page">article</div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  globalThis.document = d.window.document;
  globalThis.window = d.window as unknown as Window & typeof globalThis;
  globalThis.requestAnimationFrame = () => { return 1; };
  globalThis.cancelAnimationFrame = () => {};
  return d;
}

const settings = { wpm: 300, fontSize: 'medium' as const, theme: 'dark' as const, smartPauses: true, wordsPerTick: 1 as const, readingMode: 'focus' as const, fontFamily: 'system' as const, ttsVoice: '', ttsRate: 1, ttsPitch: 1 };

describe('Overlay', () => {
  beforeEach(() => env());
  afterEach(() => { delete (globalThis as Record<string, unknown>).document; });

  it('mounts a shadow root with the word visible after start', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('hello world'), 300);
    const host = document.documentElement.lastElementChild as HTMLElement;
    expect(host.shadowRoot).toBeTruthy();
    expect(host.shadowRoot!.textContent).toContain('hello');
    overlay.unmount();
  });

  it('pauses on space and steps with arrows', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('a b c'), 300);
    overlay.pause();
    overlay.step(1);
    expect(hostWord()).toContain('b');
    overlay.step(1);
    expect(hostWord()).toContain('c');
    overlay.unmount();
  });

  it('starts from a requested paragraph token offset', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three'), 300, 2);
    expect(hostWord()).toContain('three');
    overlay.unmount();
  });

  it('shows empty state', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.showEmpty();
    const host = document.documentElement.lastElementChild as HTMLElement;
    expect(host.shadowRoot!.textContent).toContain('No readable text');
    overlay.unmount();
  });

  it('renders a softer 64% glass backdrop tinted by theme, not a near-black wall', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const host = document.documentElement.lastElementChild as HTMLElement;
    expect(host.style.background).toMatch(/^rgba\(/);
    expect(host.style.background).toContain('0.64');
    expect(host.style.backdropFilter).toContain('blur(');
    expect(host.style.background).toContain('15');
    overlay.updateSettings({ ...settings, theme: 'light' });
    expect(host.style.background).toContain('255');
    overlay.unmount();
  });

  it('renders the flash word in a single color without a colored anchor letter', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('reading speed'), 300);
    const word = overlayEl('.word')!;
    expect(word.querySelector('.anchor')).toBeNull();
    expect(word.querySelectorAll('span').length).toBe(0);
    overlay.unmount();
  });

  it('flashes multiple words per tick when wordsPerTick > 1', () => {
    const overlay = new Overlay({ ...settings, wordsPerTick: 2 }, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three four'), 300);
    expect(overlayEl('.word')!.textContent).toBe('one two');
    overlay.step(2);
    expect(overlayEl('.word')!.textContent).toBe('three four');
    overlay.unmount();
  });

  it('renders a multi-word chunk as one evenly styled group', () => {
    const overlay = new Overlay({ ...settings, wordsPerTick: 3 }, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three four'), 300);
    const word = overlayEl('.word')!;
    expect(word.textContent).toBe('one two three');
    expect(word.children).toHaveLength(0);
    expect(word.classList.contains('chunk')).toBe(true);
    overlay.unmount();
  });

  it('scales chunk type down and keeps single words at full size', () => {
    const overlay = new Overlay({ ...settings, wordsPerTick: 4 }, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three four'), 300);
    const css = overlayEl('style')!.textContent ?? '';
    expect(css).toContain('.word.chunk { font-size: calc(clamp(36px, 7vw, 64px) * 0.5)');
    expect(css).toContain('max-width: 88vw');
    overlay.unmount();

    const single = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    single.mount();
    single.start(tokenize('one two'), 300);
    expect(overlayEl('.word')!.classList.contains('chunk')).toBe(false);
    single.unmount();
  });

  it('renders page text as text, never as markup', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('<img src=x onerror=alert(1)>'), 300);
    const word = overlayEl('.word')!;
    expect(word.children).toHaveLength(0);
    expect(word.textContent).toContain('<img');
    overlay.unmount();
  });

  it('carries the chosen font on the host so the whole reader inherits it', () => {
    const overlay = new Overlay({ ...settings, fontFamily: 'mono' }, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const host = document.documentElement.lastElementChild as HTMLElement;
    expect(host.style.fontFamily).toContain('SF Mono');

    overlay.updateSettings({ ...settings, fontFamily: 'serif' });
    expect(host.style.fontFamily).toContain('Georgia');
    overlay.unmount();
  });

  it('draws icons in the control bar and close button', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two'), 300);
    for (const action of ['back', 'pause', 'forward', 'slower', 'faster', 'aloud', 'settings']) {
      expect(overlayEl(`.bar [data-action="${action}"] svg.icon`)).toBeTruthy();
    }
    expect(overlayEl('.close svg.icon')).toBeTruthy();
    overlay.unmount();
  });

  it('applies the reading mode class to the stage', () => {
    const overlay = new Overlay({ ...settings, readingMode: 'spotlight' }, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const stage = overlayEl('.stage');
    expect(stage?.classList.contains('spotlight')).toBe(true);
    overlay.unmount();
  });

  it('styles each reading mode distinctly', () => {
    const flow = new Overlay({ ...settings, readingMode: 'flow' }, { onClose: () => {}, onStats: () => {} });
    flow.mount();
    const flowStyle = (overlayEl('style') as HTMLStyleElement).textContent ?? '';
    expect(flowStyle).toContain('.stage.flow .word.flow-in');
    expect(flowStyle).toContain('rr-flow-in');
    flow.unmount();

    const spotlight = new Overlay({ ...settings, readingMode: 'spotlight' }, { onClose: () => {}, onStats: () => {} });
    spotlight.mount();
    const spotStyle = (overlayEl('style') as HTMLStyleElement).textContent ?? '';
    expect(spotStyle).toContain('.stage.spotlight .word');
    spotlight.unmount();
  });

  it('blends the spotlight window into the softer backdrop', () => {
    const overlay = new Overlay({ ...settings, readingMode: 'spotlight' }, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const style = (overlayEl('style') as HTMLStyleElement).textContent ?? '';
    const spotlightRules = [...style.matchAll(/\.stage\.spotlight \.word \{([^}]*)\}/g)];
    const spotlightRule = spotlightRules.at(-1)?.[1] ?? '';
    expect(spotlightRule).toContain('background: rgba(');
    expect(spotlightRule).toContain('box-shadow:');
    expect(spotlightRule).not.toContain('border:');
    overlay.unmount();
  });

  it('toggles the play/pause button with the playback state', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('a b c'), 300);
    const btn = overlayEl('.bar [data-action="pause"]') as HTMLElement;
    expect(btn.textContent).toContain('Play');
    overlay.resume();
    expect(btn.textContent).toContain('Pause');
    overlay.pause();
    expect(btn.textContent).toContain('Play');
    overlay.unmount();
  });

  it('gives the play/pause button a stable min-width so the bar does not resize', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const style = (overlayEl('style') as HTMLStyleElement).textContent ?? '';
    expect(style).toMatch(/\.bar \.primary[^}]*min-width:\s*96px/);
    overlay.unmount();
  });

  it('renders close as a top-right pill outside the bar', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    expect(overlayEl('.bar [data-action="close"]')).toBeNull();
    const close = overlayEl('.close') as HTMLElement;
    expect(close).toBeTruthy();
    expect(close.textContent).toContain('Close');
    overlay.unmount();
  });

  it('keeps close above the picker and styles it as an interactive control', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const style = (overlayEl('style') as HTMLStyleElement).textContent ?? '';
    expect(style).toMatch(/\.close[^}]*z-index:\s*\d+/);
    expect(style).toMatch(/\.close[^}]*background:/);
    expect(style).toMatch(/\.close[^}]*border:/);
    expect(style).toMatch(/\.close[^}]*cursor:\s*pointer/);
    overlay.unmount();
  });

  it('calls onClose when the close control is clicked', () => {
    const onClose = vi.fn();
    const overlay = new Overlay(settings, { onClose, onStats: () => {} });
    overlay.mount();
    (overlayEl('.close') as HTMLElement).click();
    expect(onClose).toHaveBeenCalledOnce();
    overlay.unmount();
  });

  it('labels the gear button with Settings', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const gear = overlayEl('.bar [data-action="settings"]') as HTMLElement;
    expect(gear.textContent).toContain('Settings');
    overlay.unmount();
  });

  it('opens the settings page from the gear icon', () => {
    const sendMessage = vi.fn();
    globalThis.chrome = { runtime: { sendMessage } } as unknown as typeof chrome;
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    const gear = overlayEl('.bar [data-action="settings"]') as HTMLElement;
    expect(gear).toBeTruthy();
    gear.click();
    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_OPEN_OPTIONS });
    overlay.unmount();
  });

  it('arms read-aloud without making a sound until Play', async () => {
    const sendMessage = mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three four'), 300);
    await flush();
    const aloud = overlayEl('.bar [data-action="aloud"]') as HTMLElement;
    sendMessage.mockClear();

    aloud.click();

    expect(aloud.getAttribute('aria-pressed')).toBe('true');
    expect(aloud.classList.contains('on')).toBe(true);
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: MSG_SPEAK }));

    overlay.resume();

    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_SPEAK, words: ['one', 'two', 'three', 'four'], wpm: 300 });
    overlay.unmount();
  });

  it('disarms without touching playback, handing pacing back to the ticker', async () => {
    const sendMessage = mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three four'), 300);
    await flush();
    const aloud = overlayEl('.bar [data-action="aloud"]') as HTMLElement;
    aloud.click();
    overlay.resume();
    sendMessage.mockClear();

    aloud.click();

    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_SPEAK_STOP });
    expect(aloud.getAttribute('aria-pressed')).toBe('false');
    expect(overlayEl('.bar [data-action="pause"]')!.textContent).toContain('Pause');
    overlay.unmount();
  });

  it('starts the voice on Play and stops it on Pause', async () => {
    const sendMessage = mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three'), 300);
    await flush();
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();
    const play = overlayEl('.bar [data-action="pause"]') as HTMLElement;

    play.click();
    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_SPEAK, words: ['one', 'two', 'three'], wpm: 300 });

    sendMessage.mockClear();
    play.click();
    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_SPEAK_STOP });
    overlay.unmount();
  });

  it('resumes from the start of the current sentence, not mid-clause', async () => {
    const sendMessage = mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('First sentence here. Second sentence runs on.'), 300, 5);
    await flush();
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();

    overlay.resume();

    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_SPEAK, words: ['Second', 'sentence', 'runs', 'on.'], wpm: 300 });
    expect(overlayEl('.word')!.textContent).toBe('Second');
    overlay.unmount();
  });

  it('follows the voice word by word, skipping paragraph breaks', async () => {
    mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two\n\nthree four'), 300);
    await flush();
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();
    overlay.resume();

    // Utterance text is "one two three four"; charIndex 8 is the start of "three".
    overlay.onSpeakProgress(0, 8);

    expect(overlayEl('.word')!.textContent).toBe('three');
    overlay.unmount();
  });

  it('ignores progress once speech has stopped', async () => {
    mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three'), 300);
    await flush();
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();
    overlay.resume();
    overlay.pause();

    overlay.onSpeakProgress(0, 8);

    expect(overlayEl('.word')!.textContent).toBe('one');
    overlay.unmount();
  });

  it('debounces seeking so a held key does not stutter the voice', async () => {
    vi.useFakeTimers();
    const sendMessage = mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three four five six'), 300);
    await vi.advanceTimersByTimeAsync(0);
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();
    overlay.resume();
    sendMessage.mockClear();

    overlay.step(1);
    overlay.step(1);
    overlay.step(1);
    const speakCalls = () => sendMessage.mock.calls.filter((call) => (call[0] as { type: string }).type === MSG_SPEAK);
    expect(speakCalls()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(300);
    expect(speakCalls()).toHaveLength(1);
    overlay.unmount();
    vi.useRealTimers();
  });

  it('falls back to the ticker when the engine sends no word events', async () => {
    vi.useFakeTimers();
    mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two three'), 300);
    await vi.advanceTimersByTimeAsync(0);
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();
    let frames = 0;
    globalThis.requestAnimationFrame = () => { frames++; return 1; };

    overlay.resume();
    expect(frames).toBe(0);

    await vi.advanceTimersByTimeAsync(1600);
    expect(frames).toBeGreaterThan(0);
    overlay.unmount();
    vi.useRealTimers();
  });

  it('hides the aloud button when the browser has no voice', async () => {
    mockRuntime(false);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two'), 300);
    await flush();

    expect((overlayEl('.bar [data-action="aloud"]') as HTMLElement).hidden).toBe(true);
    overlay.unmount();
  });

  it('stops speech when the reader closes', async () => {
    const sendMessage = mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two'), 300);
    await flush();
    (overlayEl('.bar [data-action="aloud"]') as HTMLElement).click();
    overlay.resume();
    sendMessage.mockClear();

    overlay.unmount();

    expect(sendMessage).toHaveBeenCalledWith({ type: MSG_SPEAK_STOP });
  });

  it('reports why speech could not start', async () => {
    mockRuntime(true);
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.start(tokenize('one two'), 300);
    await flush();
    const aloud = overlayEl('.bar [data-action="aloud"]') as HTMLElement;
    aloud.click();
    overlay.resume();

    overlay.onSpeakState(false, 'No text-to-speech voice is installed in this browser.');

    expect(aloud.textContent).toContain('Aloud');
    expect(overlayEl('.meta')!.textContent).toContain('No text-to-speech voice');
    overlay.unmount();
  });
});

function mockRuntime(available: boolean) {
  const sendMessage = vi.fn(async (message: { type: string }) =>
    (message.type === MSG_TTS_CHECK ? { available } : undefined));
  globalThis.chrome = { runtime: { sendMessage } } as unknown as typeof chrome;
  return sendMessage;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function hostWord() {
  const host = document.documentElement.lastElementChild as HTMLElement;
  return host.shadowRoot!.textContent ?? '';
}

function overlayEl(sel: string): Element | null {
  const host = document.documentElement.lastElementChild as HTMLElement;
  return host.shadowRoot?.querySelector(sel) ?? null;
}
