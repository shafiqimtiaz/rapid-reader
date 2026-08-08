/** Tags that open a new paragraph in the token stream. */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIALOG', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP',
  'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TD', 'TH', 'TR', 'UL',
]);

/** Tags that never carry readable prose. */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'OBJECT', 'EMBED',
  'MAP', 'AREA', 'TEMPLATE', 'SELECT', 'OPTION', 'TEXTAREA', 'INPUT', 'BUTTON', 'LABEL', 'FORM',
  'NAV', 'ASIDE', 'DIALOG',
]);

/** Blocks that are page furniture on their own, but hold the title inside an article. */
const CHROME_TAGS = new Set(['HEADER', 'FOOTER']);

const PROSE_SELECTOR = 'p, blockquote, pre, li, dd, dt, figcaption, h1, h2, h3, h4, h5, h6, td';

export function extractSelection(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;
  const text = sel.toString().replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export interface ArticleContent {
  root: HTMLElement;
  text: string;
}

export interface TextPart {
  node: Text;
  text: string;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isHidden(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  return style ? style.display === 'none' || style.visibility === 'hidden' : false;
}

/**
 * A site header or footer is furniture; an article's own header carries the
 * headline. Telling them apart by "has a heading and no nav" keeps the <h1>.
 */
function isPageFurniture(el: HTMLElement): boolean {
  if (!CHROME_TAGS.has(el.tagName)) return false;
  return el.querySelector('nav') !== null || el.querySelector('h1, h2, h3, h4, h5, h6') === null;
}

function isSkipped(el: HTMLElement): boolean {
  return SKIP_TAGS.has(el.tagName) || isPageFurniture(el) || isHidden(el);
}

/**
 * Paragraphs of `root` in document order, each carrying the text nodes it came
 * from. `cleanText` and the start markers both read from this so a paragraph's
 * position in the token stream and its position in the DOM can never drift.
 */
export function extractBlocks(root: HTMLElement): TextPart[][] {
  const blocks: TextPart[][] = [];
  let current: TextPart[] = [];
  const flush = () => {
    if (current.length > 0) { blocks.push(current); current = []; }
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalize(node.textContent ?? '');
      if (text) current.push({ node: node as Text, text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (isSkipped(el)) return;
    if (BLOCK_TAGS.has(el.tagName)) flush();
    for (const child of el.childNodes) visit(child);
    if (BLOCK_TAGS.has(el.tagName)) flush();
  };

  visit(root);
  flush();
  return blocks;
}

export function cleanText(root: HTMLElement): string {
  return extractBlocks(root)
    .map((block) => block.map((part) => part.text).join('\n'))
    .join('\n\n');
}

function proseLength(el: HTMLElement): number {
  let total = 0;
  for (const prose of el.querySelectorAll<HTMLElement>(PROSE_SELECTOR)) {
    if (prose.querySelector(PROSE_SELECTOR)) continue;
    if (isHidden(prose)) continue;
    total += normalize(prose.textContent ?? '').length;
  }
  return total;
}

function linkLength(el: HTMLElement): number {
  let total = 0;
  for (const link of el.querySelectorAll('a[href]')) total += normalize(link.textContent ?? '').length;
  return total;
}

/** Prose length minus link text, so menus and card grids never win. */
function score(el: HTMLElement): number {
  const prose = proseLength(el);
  if (prose === 0) return 0;
  const links = linkLength(el);
  if (links / prose > 0.5) return 0;
  return prose - links;
}

/**
 * Climbs out of the best-scoring container while the parent adds little beyond
 * it — that is what pulls a headline sitting just outside the body text in.
 */
function widen(best: HTMLElement, body: HTMLElement): HTMLElement {
  let root = best;
  let bestScore = score(root);
  while (root.parentElement && root.parentElement !== body.parentElement && root !== body) {
    const parent = root.parentElement;
    const parentScore = score(parent);
    // Only worth climbing if the parent adds prose, and not so much that it is a different section.
    if (parentScore <= bestScore || parentScore > bestScore * 1.25) break;
    root = parent;
    bestScore = parentScore;
  }
  return root;
}

export function extractArticleContent(): ArticleContent | null {
  const body = document.body;
  if (!body) return null;

  // Only containers that directly hold prose compete, otherwise an outer wrapper
  // always wins on raw text length and drags in whatever sits beside the article.
  const candidates = new Set<HTMLElement>();
  for (const el of body.querySelectorAll<HTMLElement>(PROSE_SELECTOR)) {
    if (el.querySelector(PROSE_SELECTOR)) continue;
    if (el.parentElement) candidates.add(el.parentElement);
  }
  for (const el of body.querySelectorAll<HTMLElement>('article, main, [role="main"], [itemprop="articleBody"]')) {
    candidates.add(el);
  }

  let best: HTMLElement | undefined;
  let bestScore = 0;
  for (const el of candidates) {
    if (isSkipped(el)) continue;
    const value = score(el);
    // On a tie the tighter container wins; widen() climbs back out if that gains prose.
    const tighter = value === bestScore && best !== undefined && best.contains(el);
    if (value > bestScore || tighter) {
      bestScore = value;
      best = el;
    }
  }
  if (best === undefined || bestScore === 0) return null;

  const root = widen(best, body);
  const text = cleanText(root);
  return text.length >= 40 ? { root, text } : null;
}

export function extractArticle(): string | null {
  return extractArticleContent()?.text ?? null;
}
