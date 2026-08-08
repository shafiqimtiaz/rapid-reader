import { Overlay } from './overlay';
import { extractArticleContent, extractSelection } from './extractor';
import { createStartMarkers, type StartMarker } from './start-marker';
import { loadSettings, normalizeSettings, SETTINGS_KEY } from '../shared/settings';
import { MSG_START, MSG_STOP, MSG_SETTINGS, MSG_STATS, MSG_SPEAK_STATE, MSG_SPEAK_PROGRESS, type Message, type StatsMessage } from '../shared/messages';
import { tokenizeParagraphs } from '../rsvp/engine';

let overlay: Overlay | null = null;
let startMarker: StartMarker | null = null;

function removeStartMarker(): void {
  startMarker?.remove();
  startMarker = null;
}

function openReader(tokens: ReturnType<typeof tokenizeParagraphs>['tokens'], settings: Awaited<ReturnType<typeof loadSettings>>, startIndex = 0): void {
  if (overlay) overlay.unmount();
  overlay = new Overlay(settings, {
    onClose: () => { overlay?.unmount(); overlay = null; },
    onStats: (words, seconds) => {
      if (words > 0) void chrome.runtime.sendMessage({ type: MSG_STATS, words, seconds } satisfies StatsMessage);
    },
  });
  overlay.mount();

  if (tokens.length === 0) {
    overlay.showEmpty();
    return;
  }
  overlay.start(tokens, settings.wpm, startIndex);
}

async function startRead(_source: 'selection' | 'article'): Promise<void> {
  removeStartMarker();
  const settings = await loadSettings();
  const selection = extractSelection();
  const article = selection ? null : extractArticleContent();
  const text = selection ?? article?.text ?? null;
  const { tokens } = text ? tokenizeParagraphs(text) : { tokens: [] };

  if (tokens.length === 0) {
    openReader(tokens, settings);
    return;
  }

  if (!selection && article) {
    const marker = createStartMarkers(article.root, async (startIndex) => {
      startMarker = null;
      openReader(tokens, await loadSettings(), startIndex);
    });
    if (marker) {
      startMarker = marker;
      return;
    }
  }

  openReader(tokens, settings);
}

// Saving on the options page reaches every open reader here, so no tab needs a reload.
chrome.storage.onChanged.addListener((changes, area) => {
  const change = changes[SETTINGS_KEY];
  if (area !== 'sync' || !change || !overlay) return;
  overlay.updateSettings(normalizeSettings(change.newValue));
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === MSG_START) {
    void startRead(message.source).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === MSG_STOP) {
    removeStartMarker();
    overlay?.unmount();
    overlay = null;
  }
  if (message.type === MSG_SETTINGS && overlay) {
    void loadSettings().then((s) => overlay?.updateSettings(s));
  }
  if (message.type === MSG_SPEAK_STATE) {
    overlay?.setSpeaking(message.speaking, message.reason);
  }
  if (message.type === MSG_SPEAK_PROGRESS) {
    overlay?.onSpeakProgress(message.utterance, message.charIndex);
  }
  return false;
});
