const BLOCK_TAGS = new Set(['P', 'DIV', 'ARTICLE', 'SECTION', 'MAIN', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NAV', 'ASIDE', 'HEADER', 'FOOTER', 'NOSCRIPT', 'IFRAME', 'SVG']);

export function extractSelection(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;
  const text = sel.toString().replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export function extractArticle(): string | null {
  const root = document.body;
  if (!root) return null;
  root.querySelectorAll('script, style, nav, aside, header, footer, noscript, iframe, svg, [aria-hidden="true"]')
    .forEach((el) => el.remove());

  const candidates: HTMLElement[] = [];
  const article = root.querySelector('article');
  if (article instanceof HTMLElement) candidates.push(article);

  for (const el of root.querySelectorAll('p')) {
    const parent = el.parentElement;
    if (parent) candidates.push(parent);
  }
  for (const el of root.querySelectorAll('div, section, main')) {
    if (el instanceof HTMLElement) candidates.push(el);
  }

  let best: HTMLElement | null = null;
  let bestLen = 0;
  for (const el of candidates) {
    if (best && el.contains(best)) continue;
    const len = el.textContent?.length ?? 0;
    if (len > bestLen) { bestLen = len; best = el; }
  }

  const text = best ? cleanText(best) : '';
  return text.length >= 40 ? text : null;
}

export function cleanText(root: HTMLElement): string {
  const parts: string[] = [];
  let lastWasBlock = false;
  const flush = (block: boolean) => {
    if (block && parts.length > 0 && !lastWasBlock) parts.push('');
    lastWasBlock = block;
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) { parts.push(text); lastWasBlock = false; }
      return;
    }
    const el = node as HTMLElement;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.tagName === 'BR') { flush(false); return; }
    if (BLOCK_TAGS.has(el.tagName)) flush(true);
    for (const child of el.childNodes) visit(child);
    if (BLOCK_TAGS.has(el.tagName)) flush(true);
  };

  visit(root);
  flush(true);

  const out: string[] = [];
  let pendingBlank = false;
  for (const p of parts) {
    if (p === '') { pendingBlank = true; continue; }
    if (pendingBlank && out.length > 0) out.push('');
    pendingBlank = false;
    out.push(p);
  }
  return out.join('\n');
}
