// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { cleanText, extractArticle } from '../src/content/extractor';

function dom(html: string) {
  const d = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  globalThis.document = d.window.document;
  globalThis.window = d.window as unknown as Window & typeof globalThis;
  globalThis.getSelection = () => ({ toString: () => '' }) as unknown as Selection;
  return d;
}

describe('cleanText', () => {
  afterEach(() => { delete (globalThis as Record<string, unknown>).document; });
  it('joins paragraphs with blank lines', () => {
    const d = dom('<p>First para.</p><p>Second para.</p>');
    expect(cleanText(d.window.document.body)).toBe('First para.\n\nSecond para.');
  });
  it('skips script/style content', () => {
    const d = dom('<p>Visible</p><script>var x = "hidden";</script><style>.a{}</style>');
    expect(cleanText(d.window.document.body)).toBe('Visible');
  });
  it('collapses inner whitespace', () => {
    const d = dom('<p>a   b\tc\n  d</p>');
    expect(cleanText(d.window.document.body)).toBe('a b c d');
  });
});

describe('extractArticle', () => {
  beforeEach(() => dom('<div id="root"></div>'));
  it('prefers <article>', () => {
    dom('<nav>Nav junk</nav><article><p>Real content here, long enough to count as readable.</p></article>');
    const text = extractArticle();
    expect(text).toContain('Real content');
    expect(text).not.toContain('Nav junk');
  });
  it('returns null when nothing readable', () => {
    dom('<div>tiny</div>');
    expect(extractArticle()).toBeNull();
  });
  it('removes nav/aside/header/footer', () => {
    dom('<header>Site header</header><nav>Links</nav><main><p>Main paragraph content that is long enough.</p></main><footer>Footer junk</footer>');
    const text = extractArticle();
    expect(text).toContain('Main paragraph');
    expect(text).not.toContain('header');
    expect(text).not.toContain('Links');
    expect(text).not.toContain('Footer');
  });
});
