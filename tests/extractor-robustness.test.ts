// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { cleanText, extractArticleContent } from '../src/content/extractor';
import { createStartMarkers } from '../src/content/start-marker';

function dom(html: string) {
  const d = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url: 'http://localhost/' });
  globalThis.document = d.window.document;
  globalThis.window = d.window as unknown as Window & typeof globalThis;
  return d;
}

const BODY = 'Body text that runs on long enough to be recognised as the real article content of this page.';

function markerLabels(): string[] {
  const content = extractArticleContent();
  if (!content) return [];
  createStartMarkers(content.root, () => {});
  return [...content.root.querySelectorAll('mark[data-rapid-read-start]')].map((mark) => mark.textContent ?? '');
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).document;
  delete (globalThis as Record<string, unknown>).window;
});

describe('article root selection', () => {
  it('keeps an <h1> that sits inside the article header', () => {
    dom(`<header><nav>Home About Contact</nav></header>
      <article><header><h1>Real Headline Here</h1><p>By a reporter</p></header><p>${BODY}</p></article>`);
    const content = extractArticleContent()!;

    expect(content.text).toContain('Real Headline Here');
    expect(content.text).not.toContain('Home About');
    expect(markerLabels()[0]).toBe('Real');
  });

  it('widens past the body wrapper to reach a headline outside it', () => {
    dom(`<div class="post"><h1>Outside Headline</h1><div class="post-body"><p>${BODY}</p><p>${BODY}</p></div></div>`);
    const content = extractArticleContent()!;

    expect(content.root.className).toBe('post');
    expect(content.text.startsWith('Outside Headline')).toBe(true);
    expect(markerLabels()).toEqual(['Outside', 'Body', 'Body']);
  });

  it('does not widen into an unrelated sibling section', () => {
    dom(`<div><div class="post"><p>${BODY}</p><p>${BODY}</p><p>${BODY}</p></div>
      <div class="related"><p>${BODY}</p></div></div>`);
    expect(extractArticleContent()!.root.className).toBe('post');
  });

  it('ignores a link menu that is longer than the prose', () => {
    const links = Array.from({ length: 30 }, (_, i) => `<li><a href="/p${i}">Some navigation link title ${i}</a></li>`).join('');
    dom(`<div class="menu"><ul>${links}</ul></div><div class="post"><p>${BODY}</p></div>`);
    expect(extractArticleContent()!.root.className).toBe('post');
  });

  it('leaves the page DOM untouched', () => {
    const d = dom(`<nav id="menu">Home About</nav><article><p>${BODY}</p></article>`);
    extractArticleContent();
    expect(d.window.document.getElementById('menu')).not.toBeNull();
    expect(d.window.document.querySelectorAll('nav')).toHaveLength(1);
  });

  it('returns null when the page has no prose', () => {
    dom('<div>tiny</div><nav><a href="/a">One</a><a href="/b">Two</a></nav>');
    expect(extractArticleContent()).toBeNull();
  });
});

describe('block coverage', () => {
  it('treats headings, lists, quotes, captions and cells as their own paragraphs', () => {
    dom(`<article>
      <h1>Title One</h1><p>${BODY}</p>
      <h2>Section Two</h2><ul><li>First item text</li><li>Second item text</li></ul>
      <blockquote>Quoted line text</blockquote>
      <figure><img alt=""><figcaption>Caption line text</figcaption></figure>
      <table><tr><td>Cell one text</td><td>Cell two text</td></tr></table>
      <pre>code sample text</pre>
    </article>`);

    expect(markerLabels()).toEqual([
      'Title', 'Body', 'Section', 'First', 'Second', 'Quoted', 'Caption', 'Cell', 'Cell', 'code',
    ]);
  });

  it('skips hidden, aria-hidden and display:none blocks', () => {
    dom(`<article><p hidden>Hidden paragraph text</p>
      <p aria-hidden="true">Aria hidden paragraph text</p>
      <p style="display:none">Styled away paragraph text</p>
      <p>${BODY}</p></article>`);
    const content = extractArticleContent()!;

    expect(content.text).toBe(BODY);
    expect(markerLabels()).toEqual(['Body']);
  });

  it('skips forms and controls but keeps the prose around them', () => {
    dom(`<article><p>${BODY}</p>
      <form><label>Email</label><input value="x"><button>Subscribe now</button></form>
      <p>Closing paragraph text here.</p></article>`);
    const content = extractArticleContent()!;

    expect(content.text).not.toContain('Subscribe');
    expect(cleanText(content.root)).toContain('Closing paragraph');
    expect(markerLabels()).toEqual(['Body', 'Closing']);
  });
});
