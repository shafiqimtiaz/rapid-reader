// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { cleanText } from '../src/content/extractor';
import { tokenizeParagraphs } from '../src/rsvp/engine';
import { createStartMarkers } from '../src/content/start-marker';

function markerOffsets(html: string): Array<{ label: string; token: string }> {
  const d = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  globalThis.document = d.window.document;
  globalThis.window = d.window as unknown as Window & typeof globalThis;
  const root = d.window.document.querySelector('article') as HTMLElement;
  const { tokens } = tokenizeParagraphs(cleanText(root));

  createStartMarkers(root, () => {});
  return [...root.querySelectorAll<HTMLElement>('mark[data-rapid-read-start]')].map((mark) => ({
    label: mark.textContent ?? '',
    token: tokens[Number(mark.getAttribute('data-rapid-read-start'))]?.text ?? '<none>',
  }));
}

describe('start marker offsets line up with the token stream', () => {
  it('aligns on a simple article', () => {
    for (const pair of markerOffsets('<article><h1>System Design</h1><p>First paragraph content.</p><p>Second paragraph content.</p></article>')) {
      expect(pair.token).toBe(pair.label);
    }
  });

  it('aligns when a paragraph holds inline markup', () => {
    for (const pair of markerOffsets('<article><h1>Title Here</h1><p>Intro <em>with</em> emphasis.</p><p>Next <strong>bold</strong> line.</p></article>')) {
      expect(pair.token).toBe(pair.label);
    }
  });

  it('aligns when blocks nest and lists appear', () => {
    for (const pair of markerOffsets('<article><h1>Guide</h1><div><p>Wrapped paragraph text.</p></div><ul><li>First item.</li><li>Second item.</li></ul><p>Closing paragraph text.</p></article>')) {
      expect(pair.token).toBe(pair.label);
    }
  });

  it('aligns when a wrapper div holds loose text around a nested paragraph', () => {
    const pairs = markerOffsets('<article><div>Intro text here <p>Nested paragraph text.</p> tail text here</div><p>Final paragraph text.</p></article>');
    expect(pairs.map((pair) => pair.label)).toEqual(['Intro', 'Nested', 'tail', 'Final']);
    for (const pair of pairs) expect(pair.token).toBe(pair.label);
  });

  it('aligns when a paragraph starts with a link', () => {
    for (const pair of markerOffsets('<article><h1>Head Line</h1><p><a href="/x">Read next</a> plain content here.</p><p>Second content here.</p></article>')) {
      expect(pair.token).toBe(pair.label);
    }
  });

  it('aligns when a link-only paragraph is skipped', () => {
    for (const pair of markerOffsets('<article><h1>Head Line</h1><p><a href="/x">Go next</a></p><p>Readable content here.</p><p>More content here.</p></article>')) {
      expect(pair.token).toBe(pair.label);
    }
  });

  it('aligns when a pre block sits between paragraphs', () => {
    for (const pair of markerOffsets('<article><p>Before block text.</p><pre>code sample here</pre><p>After block text.</p></article>')) {
      expect(pair.token).toBe(pair.label);
    }
  });

  it('marks every paragraph, not only the first few', () => {
    const paras = Array.from({ length: 6 }, (_, i) => `<p>Paragraph ${i} body text.</p>`).join('');
    const pairs = markerOffsets(`<article>${paras}</article>`);
    expect(pairs).toHaveLength(6);
    for (const pair of pairs) expect(pair.token).toBe(pair.label);
  });
});
