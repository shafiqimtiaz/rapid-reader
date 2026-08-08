// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/shared/settings';
import { MSG_START } from '../src/shared/messages';

type Listener = (...args: never[]) => unknown;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function openReaderOnArticle() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><article>
    <p>First paragraph with enough words to look like a real article body here.</p>
    <p>Second paragraph with another handful of words to read through slowly.</p>
  </article></body></html>`, { url: 'http://localhost/', pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  const listeners: Record<string, Listener> = {};
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: (fn: Listener) => { listeners.message = fn; } },
      sendMessage: vi.fn(async () => undefined),
    },
    storage: {
      onChanged: { addListener: (fn: Listener) => { listeners.storage = fn; } },
      sync: { get: async () => ({}), set: async () => {} },
    },
  } as unknown as typeof chrome;

  vi.resetModules();
  await import('../src/content/index');
  (listeners.message as (m: unknown, s: unknown, r: unknown) => void)({ type: MSG_START, source: 'article' }, {}, () => {});
  await flush();

  const mark = document.querySelector('mark[data-rapid-read-start]') as HTMLElement;
  mark.click();
  await flush();

  return listeners;
}

function shadow(selector: string): HTMLElement {
  const host = document.documentElement.lastElementChild as HTMLElement;
  return host.shadowRoot!.querySelector(selector) as HTMLElement;
}

describe('settings propagation into an open reader', () => {
  it('applies a saved change without reloading the page', async () => {
    const listeners = await openReaderOnArticle();
    expect(shadow('.word').classList.contains('chunk')).toBe(false);

    (listeners.storage as (c: unknown, a: string) => void)(
      { [SETTINGS_KEY]: { newValue: { ...DEFAULT_SETTINGS, wordsPerTick: 2, wpm: 500, theme: 'light' } } },
      'sync',
    );

    expect(shadow('.word').classList.contains('chunk')).toBe(true);
    expect(shadow('.word').textContent?.split(' ')).toHaveLength(2);
    expect(shadow('.meta').textContent).toContain('500 wpm');
  });

  it('ignores changes from other storage areas and other keys', async () => {
    const listeners = await openReaderOnArticle();
    const before = shadow('.meta').textContent;

    (listeners.storage as (c: unknown, a: string) => void)(
      { [SETTINGS_KEY]: { newValue: { ...DEFAULT_SETTINGS, wpm: 800 } } },
      'local',
    );
    (listeners.storage as (c: unknown, a: string) => void)({ 'rr:stats': { newValue: [] } }, 'sync');

    expect(shadow('.meta').textContent).toBe(before);
  });
});
