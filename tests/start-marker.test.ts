// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStartMarkers } from '../src/content/start-marker';

function dom() {
  const d = new JSDOM('<!DOCTYPE html><html><body><article><h1>System Design</h1><p>First paragraph content.</p><p>Second paragraph content.</p></article></body></html>');
  globalThis.document = d.window.document;
  globalThis.window = d.window as unknown as Window & typeof globalThis;
  return d;
}

describe('createStartMarker', () => {
  it('highlights each paragraph start and starts at the clicked token offset', () => {
    const d = dom();
    const root = d.window.document.querySelector('article') as HTMLElement;
    const onStart = vi.fn();
    const marker = createStartMarkers(root, onStart);

    expect(marker).toBeTruthy();
    const marks = [...root.querySelectorAll('mark[data-rapid-read-start]')] as HTMLElement[];
    expect(marks.map((el) => el.textContent)).toEqual(['System', 'First', 'Second']);
    expect(marks[0]?.style.background).toContain('250, 204, 21');
    expect(marks[0]?.style.textDecoration).not.toContain('dotted');

    (root.querySelectorAll('mark[data-rapid-read-start]')[1] as HTMLElement).click();

    expect(onStart).toHaveBeenCalledWith(3);
    expect(root.querySelectorAll('[data-rapid-read-start]')).toHaveLength(0);
    expect(root.textContent).toContain('System Design');
    expect(root.textContent).toContain('Second paragraph');
  });

  it('supports keyboard activation on a paragraph start token', () => {
    const d = dom();
    const root = d.window.document.querySelector('article') as HTMLElement;
    const onStart = vi.fn();
    createStartMarkers(root, onStart);
    const token = root.querySelectorAll('mark[data-rapid-read-start]')[0] as HTMLElement;

    token.dispatchEvent(new d.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onStart).toHaveBeenCalledWith(0);
    expect(root.querySelectorAll('[data-rapid-read-start]')).toHaveLength(0);
  });

  it('captures every heading and paragraph start in document order', () => {
    const d = new JSDOM('<!DOCTYPE html><html><body><article><h1>Title</h1><p>Intro text.</p><h2>Section</h2><p>Details text.</p></article></body></html>');
    globalThis.document = d.window.document;
    globalThis.window = d.window as unknown as Window & typeof globalThis;
    const root = d.window.document.querySelector('article') as HTMLElement;
    createStartMarkers(root, vi.fn());

    expect([...root.querySelectorAll('mark[data-rapid-read-start]')].map((mark) => mark.textContent)).toEqual(['Title', 'Intro', 'Section', 'Details']);
  });

  it('keeps offsets aligned when a paragraph is a div block', () => {
    const d = new JSDOM('<!DOCTYPE html><html><body><article><div>First block content.</div><p>Second block content.</p></article></body></html>');
    globalThis.document = d.window.document;
    globalThis.window = d.window as unknown as Window & typeof globalThis;
    const root = d.window.document.querySelector('article') as HTMLElement;
    const onStart = vi.fn();
    createStartMarkers(root, onStart);

    const marks = [...root.querySelectorAll('mark[data-rapid-read-start]')];
    expect(marks.map((mark) => mark.textContent)).toEqual(['First', 'Second']);
    (marks[1] as HTMLElement).click();
    expect(onStart).toHaveBeenCalledWith(4);
  });

  it('skips link text but starts at the first plain token in the paragraph', () => {
    const d = new JSDOM('<!DOCTYPE html><html><body><article><p><a href="/next">Read next</a> Plain content.</p><p>Second content.</p></article></body></html>');
    globalThis.document = d.window.document;
    globalThis.window = d.window as unknown as Window & typeof globalThis;
    const root = d.window.document.querySelector('article') as HTMLElement;
    const onStart = vi.fn();
    createStartMarkers(root, onStart);

    const marks = [...root.querySelectorAll('mark[data-rapid-read-start]')];
    expect(marks.map((mark) => mark.textContent)).toEqual(['Plain', 'Second']);
    (marks[0] as HTMLElement).click();
    expect(onStart).toHaveBeenCalledWith(2);
  });

  it('does not mark a paragraph made only of an action or redirect', () => {
    const d = new JSDOM('<!DOCTYPE html><html><body><article><p><a href="/redirect">Go next</a></p><p><button type="button">Run action</button></p><p>Readable content.</p></article></body></html>');
    globalThis.document = d.window.document;
    globalThis.window = d.window as unknown as Window & typeof globalThis;
    const root = d.window.document.querySelector('article') as HTMLElement;
    const onStart = vi.fn();
    createStartMarkers(root, onStart);

    const marks = [...root.querySelectorAll('mark[data-rapid-read-start]')] as HTMLElement[];
    expect(marks.map((mark) => mark.textContent)).toEqual(['Readable']);
    marks[0]?.click();
    expect(onStart).toHaveBeenCalledWith(3);
  });
});
