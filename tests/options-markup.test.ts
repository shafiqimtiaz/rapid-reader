import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const optionsHtml = readFileSync(resolve(process.cwd(), 'options.html'), 'utf8');

describe('options mode controls', () => {
  it('uses the mode card itself as the selection indicator', () => {
    expect(optionsHtml).not.toContain('class="mode-dot"');
    expect(optionsHtml).not.toContain('.mode-dot');
    expect(optionsHtml).toContain('.mode:has(input:checked)');
    expect(optionsHtml).toContain('.mode:focus-within');
  });

  it('exposes all three reading modes with descriptions', () => {
    expect(optionsHtml).toContain('value="focus"');
    expect(optionsHtml).toContain('One word at a time, locked to the center.');
    expect(optionsHtml).toContain('value="flow"');
    expect(optionsHtml).toContain('Slides through the text with a steady rhythm.');
    expect(optionsHtml).toContain('value="spotlight"');
    expect(optionsHtml).toContain('A compact window for distraction-free focus.');
  });
});
