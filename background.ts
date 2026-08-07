import { MSG_START, MSG_STATS, type StartMessage, type StatsMessage } from './src/shared/messages';
import { recordSession } from './src/options/stats';

async function sendStart(tabId: number, source: 'selection' | 'article'): Promise<boolean> {
  try {
    const msg: StartMessage = { type: MSG_START, source };
    await chrome.tabs.sendMessage(tabId, msg);
    return true;
  } catch {
    return false;
  }
}

async function ensureInjected(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  } catch {
    return false;
  }
}

async function toggleRead(tabId: number): Promise<void> {
  const ok = await sendStart(tabId, 'article');
  if (ok) return;
  const injected = await ensureInjected(tabId);
  if (!injected) {
    await flashBadge(tabId, '!', 'Rapid Read: this page cannot be read.');
    return;
  }
  await sendStart(tabId, 'article');
}

async function flashBadge(tabId: number, text: string, title: string): Promise<void> {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title });
  setTimeout(async () => {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'Rapid Read' });
  }, 4000);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-read') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) await toggleRead(tab.id);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id != null) await toggleRead(tab.id);
});

chrome.runtime.onMessage.addListener((message: StatsMessage) => {
  if (message.type === MSG_STATS) {
    void recordSession(message.words, message.seconds);
  }
});
