/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

function mountOptions(voices: Array<{ voiceName: string; lang: string }> = [{ voiceName: 'Test Voice', lang: 'en-GB' }]): void {
  const dom = new JSDOM(`<!doctype html><html><body>
    <h2 data-icon="reading">Reading</h2><h2 data-icon="pacing">Pacing</h2><h2 data-icon="appearance">Appearance</h2>
    <h2 data-icon="aloud">Read aloud</h2><h2 data-icon="progress">Progress</h2>
    <div class="stepper"><div class="hint"><b>Target speed</b></div></div>
    <button id="wpmDown"></button><span id="wpmVal"></span><button id="wpmUp"></button><span id="wpmNote"></span>
    <input name="readingMode" value="focus"><input name="readingMode" value="flow"><input name="readingMode" value="spotlight">
    <button id="wptDown"></button><span id="wptVal"></span><button id="wptUp"></button>
    <input id="smartPauses" type="checkbox">
    <input name="theme" value="dark"><input name="theme" value="light"><input name="theme" value="sepia">
    <input name="fontSize" value="small"><input name="fontSize" value="medium"><input name="fontSize" value="large">
    <input name="fontFamily" value="system"><input name="fontFamily" value="serif"><input name="fontFamily" value="mono"><input name="fontFamily" value="rounded">
    <div id="preview"><span id="previewWord"></span></div><input id="wpm">
    <span id="saved" hidden></span>
    <section id="ttsSection" hidden></section>
    <select id="ttsVoice"><option value=""></option></select>
    <input id="ttsRate" type="range" min="0.5" max="2" step="0.1"><span id="ttsRateVal"></span>
    <input id="ttsPitch" type="range" min="0" max="2" step="0.1"><span id="ttsPitchVal"></span>
    <button id="ttsTest"></button><button id="ttsStop"></button>
    <div id="totals"></div><svg id="chart"></svg><p id="chartEmpty"></p><button id="reset"></button>
  </body></html>`, { url: 'chrome-extension://test/options.html' });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  let settings = { ...DEFAULT_SETTINGS };
  globalThis.chrome = {
    tts: {
      getVoices: async () => voices,
      speak: () => {},
      stop: () => {},
    },
    storage: {
      sync: {
        get: async () => ({ 'rr:settings': settings }),
        set: async (value: { 'rr:settings': typeof settings }) => { settings = value['rr:settings']; },
      },
      local: {
        get: async () => ({}),
        set: async () => {},
        clear: async () => {},
      },
    },
  } as unknown as typeof chrome;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).document;
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).chrome;
});

describe('options preview', () => {
  it('updates preview font size when the large setting is selected', async () => {
    mountOptions();
    vi.resetModules();
    await import('../src/options/index');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const large = document.querySelector('input[name="fontSize"][value="large"]') as HTMLInputElement;
    large.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('preview')!.style.fontSize).toBe('42px');
  });

  it('confirms a save so no tab needs reloading', async () => {
    mountOptions();
    vi.resetModules();
    await import('../src/options/index');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('saved')!.hidden).toBe(true);

    (document.querySelector('input[name="theme"][value="sepia"]') as HTMLInputElement)
      .dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('saved')!.hidden).toBe(false);
  });

  it('draws icons in section headings and buttons, and applies the chosen font page-wide', async () => {
    mountOptions();
    vi.resetModules();
    await import('../src/options/index');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('h2[data-icon] > svg.icon')).toHaveLength(5);
    for (const id of ['wpmDown', 'wpmUp', 'wptDown', 'wptUp', 'ttsTest', 'ttsStop', 'reset']) {
      expect(document.getElementById(id)!.querySelector('svg.icon')).toBeTruthy();
    }

    (document.querySelector('input[name="fontFamily"][value="mono"]') as HTMLInputElement)
      .dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.body.style.fontFamily).toContain('SF Mono');
  });

  it('lists installed voices and shows the read-aloud section', async () => {
    mountOptions();
    vi.resetModules();
    await import('../src/options/index');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('ttsSection')!.hidden).toBe(false);
    expect(document.getElementById('ttsVoice')!.textContent).toContain('Test Voice [en-GB]');
  });

  it('hides the read-aloud section when the browser has no voice', async () => {
    mountOptions([]);
    vi.resetModules();
    await import('../src/options/index');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('ttsSection')!.hidden).toBe(true);
  });
});
