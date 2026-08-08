# Rapid Reader — Privacy Policy

*Last updated: August 8, 2026*

## TL;DR

**Rapid Reader does not collect, store, or transmit any personal data. It makes no network requests at all.** Everything it does happens on your device.

---

## 1. What data we collect

**None.** Rapid Reader has no accounts, no signups, no servers, and no analytics. The extension makes **zero network requests** — the source code contains no `fetch()` or `XMLHttpRequest` calls, and no third-party code is loaded.

## 2. Data stored on your device

| Data | Where it lives | Retention |
|------|----------------|-----------|
| Your reading settings (speed, theme, font, voice, mode) | `chrome.storage.sync` — Chrome's built-in sync, tied to your Google account | Until you change/delete them |
| Reading stats (words read, average WPM, estimated time saved) | `chrome.storage.local` — on your device only | 90 days, then automatically discarded |

- **Settings sync:** Settings are synced between your own devices through Google's standard Chrome sync. They go to Google's sync infrastructure, not to us — we have no servers to receive them.
- **Reading stats:** Words read, average speed and time saved are aggregated per day and kept locally for 90 days. They **never leave your device**.

## 3. Page content

The text you choose to read is processed **in memory only**, on your device, solely to display it word by word. It is never stored on disk and never transmitted anywhere.

## 4. Read-aloud (text-to-speech)

Rapid Reader's read-aloud feature uses Chrome's built-in `tts` API with the voices installed on your operating system. Audio is produced locally on your device — no audio is recorded or transmitted.

## 5. Permissions — what they're for

| Permission | Why Rapid Reader needs it |
|------------|---------------------------|
| `storage` | Save your settings and reading stats locally (and sync settings via Chrome sync) |
| `activeTab` | Access only the current tab when you press <kbd>Alt</kbd>+<kbd>R</kbd> or click the toolbar icon to start reading |
| `scripting` | Re-inject the reader if the content script was orphaned by an extension update or navigation |
| `tts` | Power the optional read-aloud mode |
| Content script on all websites | The core feature is reading articles on **any** website. The script is passive until you trigger it, and it reads page text solely to display it in the reader |

## 6. Third-party sharing

**None.** We do not share, sell, or disclose any data to third parties. There is no data to share.

## 7. Deleting your data

- **Uninstall** the extension in `chrome://extensions` — this removes all local data (`chrome.storage.local`).
- **Clear synced settings:** go to `chrome://settings/syncSetup` → *Clear data from your sync*, or uninstall (Chrome eventually removes sync data for the extension).
- **Clear manually:** `chrome://extensions` → Rapid Reader → *Details* → *Clear data*.

## 8. Children

This extension is not directed at children and does not collect personal information from anyone, including children.

## 9. Changes to this policy

If this policy changes, the "Last updated" date above will be revised. Because Rapid Reader collects no data, meaningful changes are unlikely.

## 10. Contact

Questions about this policy: open an issue in the Rapid Reader repository, or contact the developer through the Chrome Web Store listing.
