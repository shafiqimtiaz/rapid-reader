// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { Overlay } from '../src/content/overlay';
import { tokenize } from '../src/rsvp/engine';

function env() {
  const d = new JSDOM('<!DOCTYPE html><html><body><div id="page">article</div></body></html>', { pretendToBeVisual: true });
  globalThis.document = d.window.document;
  globalThis.window = d.window as unknown as Window & typeof globalThis;
  globalThis.requestAnimationFrame = (_cb: FrameRequestCallback) => { return 1; };
  globalThis.cancelAnimationFrame = () => {};
  return d;
}

const settings = { wpm: 300, fontSize: 'medium' as const, theme: 'dark' as const, smartPauses: true };

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

  it('shows empty state', () => {
    const overlay = new Overlay(settings, { onClose: () => {}, onStats: () => {} });
    overlay.mount();
    overlay.showEmpty();
    const host = document.documentElement.lastElementChild as HTMLElement;
    expect(host.shadowRoot!.textContent).toContain('No readable text');
    overlay.unmount();
  });
});

function hostWord() {
  const host = document.documentElement.lastElementChild as HTMLElement;
  return host.shadowRoot!.textContent ?? '';
}
