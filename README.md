# Rapid Read

RSVP (Rapid Serial Visual Presentation) speed-reading extension for Chrome. Read anything on the web 3× faster: select text or start on the whole article, and Rapid Read flashes one word at a time at a fixed point on screen, so your eyes never move.

## Features

- **Two entry modes** — read the current selection immediately, or start the whole article from any paragraph: <kbd>Alt</kbd>+<kbd>R</kbd> / toolbar click highlights the first word of every paragraph, and clicking one starts there.
- **RSVP engine** — per-token timing with smart punctuation pauses: commas, semicolons, colons, dashes and sentence enders get proportionally longer rests; paragraph breaks pause the longest. URLs, numbers and long words are handled explicitly. A multi-word chunk stays up for as long as its words would take one at a time, so wpm means the same thing at any chunk size.
- **Shadow-DOM overlay** — isolated from page CSS, with dark / light / sepia themes, three font sizes and four fonts (the font choice applies to everything: reader word, meta line, control bar, options page). Hugeicons free icons throughout. Keyboard controls while reading: `Space` pause/resume, `←`/`→` step one word, `↑`/`↓` speed ±25 wpm, `[`/`]` skip 10 words, `Esc` close.
- **Read aloud, in step with the words** — **Aloud** is a mode toggle, not a transport control: it arms the voice without making a sound. Play/Pause drives everything. With Aloud on, the voice becomes the clock and wpm instead sets the speech rate (`wpm / 180`, with a per-voice calibration slider): the display steps evenly at that rate, with no reading pauses and skipping the paragraph breaks the voice is never given, and every event the engine sends — a `word`, a `sentence`, or an utterance starting — snaps it back onto the word being spoken. Two events far enough apart also time the voice for real, so `wpm / 180` is only a seed and an engine that ignores the requested rate is measured rather than trusted; the first utterance is cut short to get that measurement early. Engines reporting per word stay exact; engines reporting only per utterance stay within a word. Since `chrome.tts` has no pause/resume, Pause stops the voice and Play re-speaks from the start of the current sentence. Seeking is debounced, so a held arrow key scrubs silently. Speech runs in the service worker on offline system voices, so it survives the overlay closing; if speech dies early the wpm ticker takes back over rather than freezing. With no voice installed, the button and the whole options section stay hidden.
- **Reading stats** — words read, average WPM and estimated time saved (vs. a 240 WPM baseline), rolled up per day and kept 90 days. Dashboard on the options page.
- **Settings persist and propagate** — every control on the options page saves to `chrome.storage.sync` on change (WPM 100–1000 in 25-wpm steps, reading mode, words per tick, theme, font size, font, smart pauses, read-aloud voice / rate / pitch) and a `storage.onChanged` listener applies it to every reader already open, so no tab needs reloading. Live preview on the options page.

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
npm test        # vitest — tokenizer, pauses, timing, stats, extractor, start markers, overlay, settings, tts, messages
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
src/content/extractor.ts non-destructive article + selection extraction: scores prose containers,
                         rejects link-dense menus, widens to reach a headline outside the body wrapper
src/content/overlay.ts   shadow-DOM RSVP overlay (controls, themes, font sizes)
src/rsvp/engine.ts       tokenizer + RSVP timing (per-token delays, 25 wpm steps, sentence starts)
src/rsvp/pauses.ts       punctuation pause multipliers
src/options/             options page UI + reading-stats rollup
src/content/start-marker.ts  clickable paragraph-start markers, offsets derived from the same walk as the tokenizer
src/shared/settings.ts   settings model, defaults, storage sync
src/shared/tts.ts        chrome.tts read-aloud — utterance queue, wpm→rate, charIndex→word mapping
src/shared/icon.ts       renders Hugeicons data as SVG (no framework renderer needed)
src/shared/messages.ts   content ↔ background message contract
```

## License

Private project — all rights reserved.
