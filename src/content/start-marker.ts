import { extractBlocks, type TextPart } from './extractor';

const MARKER_ATTR = 'data-rapid-read-start';
// Non-prose tags are already gone from extractBlocks, so all that is left to avoid
// is putting a clickable mark inside something the page itself handles clicks for.
const INTERACTIVE_SELECTOR = 'a[href], area[href], button, input, select, textarea, option, summary, form, [role="link"], [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [onclick], [onmousedown], [ontouchstart], [data-action], [data-href], [data-url], [data-redirect]';

export interface StartMarker {
  remove(): void;
}

interface TokenRange {
  node: Text;
  start: number;
  end: number;
  wordsBefore: number;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * First token of a paragraph that is safe to click: skips text that lives inside
 * links, buttons and other interactive nodes, while still counting its words so
 * the returned offset matches the token stream.
 */
function firstTokenRange(block: TextPart[]): TokenRange | null {
  let wordsBefore = 0;
  for (const part of block) {
    const raw = part.node.nodeValue ?? '';
    const match = /\S+/.exec(raw);
    const skipped = part.node.parentElement?.closest(`[${MARKER_ATTR}], ${INTERACTIVE_SELECTOR}`);
    if (match && !skipped) {
      return { node: part.node, start: match.index, end: match.index + match[0].length, wordsBefore };
    }
    wordsBefore += wordCount(part.text);
  }
  return null;
}

export function createStartMarkers(
  root: HTMLElement,
  onStart: (tokenOffset: number) => void | Promise<void>,
): StartMarker | null {
  const marks: HTMLElement[] = [];
  const targets: Array<{ range: TokenRange; tokenOffset: number }> = [];

  // Mirrors tokenizeParagraphs: every paragraph contributes its words plus one
  // paragraph-break token.
  let tokenOffset = 0;
  for (const block of extractBlocks(root)) {
    const range = firstTokenRange(block);
    if (range) targets.push({ range, tokenOffset: tokenOffset + range.wordsBefore });
    tokenOffset += block.reduce((total, part) => total + wordCount(part.text), 0) + 1;
  }

  function removeAll(): void {
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) continue;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      mark.remove();
    }
    marks.length = 0;
  }

  for (const target of targets) {
    const range = root.ownerDocument.createRange();
    range.setStart(target.range.node, target.range.start);
    range.setEnd(target.range.node, target.range.end);

    const mark = root.ownerDocument.createElement('mark');
    mark.setAttribute(MARKER_ATTR, String(target.tokenOffset));
    mark.setAttribute('role', 'button');
    mark.setAttribute('tabindex', '0');
    mark.setAttribute('aria-label', 'Start reading from this paragraph');
    mark.setAttribute('title', 'Start reading from this paragraph');
    mark.style.cssText = 'background: rgba(250, 204, 21, 0.35); color: inherit; border-radius: 0.2em; padding: 0 0.08em; cursor: pointer;';
    range.surroundContents(mark);

    const start = (): void => {
      removeAll();
      void onStart(target.tokenOffset);
    };
    mark.addEventListener('click', start);
    mark.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        start();
      }
    });
    marks.push(mark);
  }

  if (marks.length === 0) return null;
  return { remove: removeAll };
}
