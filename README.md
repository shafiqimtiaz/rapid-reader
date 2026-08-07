# Rapid Read

RSVP (Rapid Serial Visual Presentation) speed-reading extension for Chrome. Read anything on the web 3× faster: select text or start on the whole article, and Rapid Read flashes one word at a time at a fixation-optimized point.

## Features

- **Two entry modes** — read the current selection, or the whole article (paragraph-level extraction, <kbd>Alt</kbd>+<kbd>R</kbd> / toolbar click).
- **RSVP engine** — per-token timing with fixation-point anchoring and smart punctuation pauses: commas, semicolons, colons, dashes and sentence enders get proportionally longer rests; paragraph breaks pause the longest. URLs, numbers and long words are handled explicitly.
- **Shadow-DOM overlay** — isolated from page CSS, with dark / light / sepia themes and three font sizes. Keyboard controls while reading: `Space` pause/resume, `+`/`-` speed, `Esc` close.
- **Reading stats** — words read, average WPM and estimated time saved (vs. a 240 WPM baseline), rolled up per day and kept 90 days. Dashboard on the options page.
- **Settings persist** via `chrome.storage.sync` (WPM 100–1000, theme, font size, smart pauses), with live preview on the options page.

## Install (development)

```bash
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the `dist/` directory
4. Open any article page and press <kbd>Alt</kbd>+<kbd>R</kbd>, or click the toolbar icon

## Development

```bash
npm run check   # tsc --noEmit + eslint
npm test        # vitest (45 tests: tokenizer, pauses, timing, stats, extractor, overlay, settings, messages)
npm run build   # icons → content script → background → options page → manifest, into dist/
```

The build runs four Vite passes into `dist/`:

| Step | Source | Output |
|------|--------|--------|
| `scripts/gen-icons.mjs` | — | `dist/icons/*.png` (generated, no binary assets in the repo) |
| content build | `src/content/index.ts` | `dist/content.js` |
| background build | `background.ts` | `dist/background.js` |
| options build | `options.html` + `src/options/` | `dist/options.html`, `dist/options.js` |
| manifest copy | `manifest.json` | `dist/manifest.json` |

`npm run dev:content` rebuilds the content script on change; after a content-script change, reload the extension on `chrome://extensions`.

`test-pages/article.html` is a local sample article for manual smoke testing (`file://` pages work because the content script is declared in the manifest).

## Architecture

```
background.ts            service worker — Alt+R / toolbar toggle, ensures injection, records sessions
src/content/index.ts     wiring — message handling, selection/article extraction, overlay lifecycle
src/content/extractor.ts article + selection text extraction (paragraph-aware)
src/content/overlay.ts   shadow-DOM RSVP overlay (controls, themes, font sizes)
src/rsvp/engine.ts       tokenizer + RSVP timing (fixation point, per-token delays)
src/rsvp/fixation.ts     fixation index — where in the word the eye lands
src/rsvp/pauses.ts       punctuation pause multipliers
src/options/             options page UI + reading-stats rollup
src/shared/settings.ts   settings model, defaults, storage sync
src/shared/messages.ts   content ↔ background message contract
```

## License

Private project — all rights reserved.
