import { MSG_START, MSG_STATS, MSG_OPEN_OPTIONS, MSG_SPEAK, MSG_SPEAK_STOP, MSG_SPEAK_STATE, MSG_SPEAK_PROGRESS, MSG_TTS_CHECK, type StartMessage, type SpeakStateMessage, type SpeakProgressMessage, type TtsCheckReply, type Message } from './src/shared/messages';
import { recordSession } from './src/options/stats';
import { speak, stopSpeaking } from './src/shared/tts';

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
    await flashBadge(tabId, '!', 'Rapid Reader: this page cannot be read.');
    return;
  }
  await sendStart(tabId, 'article');
}

async function flashBadge(tabId: number, text: string, title: string): Promise<void> {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title });
  setTimeout(async () => {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'Rapid Reader' });
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

async function notifySpeakState(tabId: number | undefined, speaking: boolean, reason?: string): Promise<void> {
  if (tabId == null) return;
  const msg: SpeakStateMessage = { type: MSG_SPEAK_STATE, speaking, reason };
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // The tab closed or navigated while speech was running.
  }
}

async function notifySpeakProgress(tabId: number | undefined, utterance: number, charIndex: number): Promise<void> {
  if (tabId == null) return;
  const msg: SpeakProgressMessage = { type: MSG_SPEAK_PROGRESS, utterance, charIndex };
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // The tab closed or navigated while speech was running.
  }
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type === MSG_STATS) {
    void recordSession(message.words, message.seconds);
  }
  if (message.type === MSG_OPEN_OPTIONS) {
    void chrome.runtime.openOptionsPage();
  }
  if (message.type === MSG_SPEAK) {
    const tabId = sender.tab?.id;
    void speak(message.words, message.wpm, {
      onProgress: (utterance, charIndex) => void notifySpeakProgress(tabId, utterance, charIndex),
      onDone: () => void notifySpeakState(tabId, false),
    }).then((result) => { if (!result.ok) void notifySpeakState(tabId, false, result.reason); });
  }
  if (message.type === MSG_SPEAK_STOP) {
    // Not chrome.tts.stop: a queue still being timed would otherwise resume after the stop.
    stopSpeaking();
  }
  if (message.type === MSG_TTS_CHECK) {
    void chrome.tts.getVoices().then((voices) => {
      sendResponse({ available: voices.length > 0 } satisfies TtsCheckReply);
    });
    return true;
  }
  return false;
});
