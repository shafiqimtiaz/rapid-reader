import { Overlay } from './overlay';
import { extractArticle, extractSelection } from './extractor';
import { loadSettings } from '../shared/settings';
import { MSG_START, MSG_STOP, MSG_SETTINGS, MSG_STATS, type Message, type StatsMessage } from '../shared/messages';
import { tokenize } from '../rsvp/engine';

let overlay: Overlay | null = null;

async function startRead(source: 'selection' | 'article'): Promise<void> {
  const settings = await loadSettings();
  const selection = extractSelection();
  const text = source === 'selection' ? selection : (selection ?? extractArticle());
  const tokens = text ? tokenize(text) : [];

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
  overlay.start(tokens, settings.wpm);
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === MSG_START) {
    void startRead(message.source).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === MSG_STOP) {
    overlay?.unmount();
    overlay = null;
  }
  if (message.type === MSG_SETTINGS && overlay) {
    void loadSettings().then((s) => overlay?.updateSettings(s));
  }
  return false;
});
