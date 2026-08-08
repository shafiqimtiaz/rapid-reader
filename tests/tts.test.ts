import { describe, expect, it, vi } from 'vitest';
import { MAX_CHUNK, TTS_BASE_WPM, rateForWpm, speak, utterances, wordAtChar } from '../src/shared/tts';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

const speakSpy = vi.fn();
const stopSpy = vi.fn();

function mockChrome(settings: Record<string, unknown>, voices: Array<{ voiceName: string; lang?: string }> = [{ voiceName: 'Test Voice', lang: 'en-GB' }]): void {
  speakSpy.mockClear();
  stopSpy.mockClear();
  globalThis.chrome = {
    storage: { sync: { get: async () => ({ 'rr:settings': { ...DEFAULT_SETTINGS, ...settings } }) } },
    tts: { speak: speakSpy, stop: stopSpy, getVoices: async () => voices },
  } as unknown as typeof chrome;
}

const optionsOf = (call: number): chrome.tts.SpeakOptions => speakSpy.mock.calls[call]![1] as chrome.tts.SpeakOptions;
const noHandlers = { onProgress: () => {}, onDone: () => {} };

describe('utterances', () => {
  it('keeps short text as one utterance and records where each word starts', () => {
    const [first] = utterances(['one', 'two', 'three']);
    expect(first!.text).toBe('one two three');
    expect(first!.startWord).toBe(0);
    expect(first!.wordStarts).toEqual([0, 4, 8]);
  });

  it('splits long text and carries the word offset forward', () => {
    const words = Array.from({ length: 900 }, (_, i) => (i % 6 === 5 ? `w${i}.` : `w${i}`));
    const queue = utterances(words);

    expect(queue.length).toBeGreaterThan(1);
    for (const utterance of queue) expect(utterance.text.length).toBeLessThanOrEqual(MAX_CHUNK);
    expect(queue[0]!.startWord).toBe(0);
    expect(queue[1]!.startWord).toBe(queue[0]!.wordStarts.length);
    const spoken = queue.reduce((total, utterance) => total + utterance.wordStarts.length, 0);
    expect(spoken).toBe(words.length);
  });

  it('cuts the first utterance short so the reader can time the voice early', () => {
    const words = Array.from({ length: 900 }, (_, i) => (i % 6 === 5 ? `w${i}.` : `w${i}`));
    const queue = utterances(words);

    expect(queue[0]!.text.length).toBeLessThan(MAX_CHUNK / 3);
    expect(queue[1]!.text.length).toBeGreaterThan(MAX_CHUNK / 3);
    expect(queue[0]!.text.endsWith('.')).toBe(true);
  });

  it('returns nothing when there are no words', () => {
    expect(utterances([])).toEqual([]);
    expect(utterances([''])).toEqual([]);
  });
});

describe('wordAtChar', () => {
  it('maps a spoken charIndex onto the word being said', () => {
    const [first] = utterances(['alpha', 'beta', 'gamma']);
    expect(wordAtChar(first!, 0)).toBe(0);
    expect(wordAtChar(first!, 3)).toBe(0);
    expect(wordAtChar(first!, 6)).toBe(1);
    expect(wordAtChar(first!, 11)).toBe(2);
    expect(wordAtChar(first!, 999)).toBe(2);
  });
});

describe('rateForWpm', () => {
  it('scales the voice to the reading speed', () => {
    expect(rateForWpm(TTS_BASE_WPM, 1)).toBe(1);
    expect(rateForWpm(360, 1)).toBe(2);
    expect(rateForWpm(90, 1)).toBe(0.5);
  });
  it('applies the stored calibration on top', () => {
    expect(rateForWpm(TTS_BASE_WPM, 1.5)).toBe(1.5);
    expect(rateForWpm(360, 0.5)).toBe(1);
  });
  it('stays inside what chrome.tts accepts', () => {
    expect(rateForWpm(100000, 2)).toBe(10);
    expect(rateForWpm(1, 0.001)).toBe(0.1);
  });
});

describe('speak', () => {
  it('paces the voice at the reader speed and uses the stored voice and pitch', async () => {
    mockChrome({ ttsVoice: 'Test Voice', ttsRate: 1, ttsPitch: 0.8 });
    const result = await speak(['hello', 'there'], 360, noHandlers);

    expect(result).toEqual({ ok: true });
    expect(stopSpy).toHaveBeenCalled();
    expect(speakSpy.mock.calls[0]![0]).toBe('hello there');
    expect(optionsOf(0).voiceName).toBe('Test Voice');
    expect(optionsOf(0).rate).toBe(2);
    expect(optionsOf(0).pitch).toBe(0.8);
    expect(optionsOf(0).enqueue).toBe(false);
  });

  it('asks for a voice that reports words without insisting on one', async () => {
    mockChrome({});
    await speak(['hello'], 300, noHandlers);

    const options = optionsOf(0) as chrome.tts.SpeakOptions & { desiredEventTypes?: string[] };
    expect(options.desiredEventTypes).toContain('word');
    // Every type the handler acts on has to be listed, or it may never arrive.
    for (const type of ['sentence', 'start', 'end', 'error', 'interrupted', 'cancelled']) {
      expect(options.desiredEventTypes).toContain(type);
    }
    expect(options.requiredEventTypes).toBeUndefined();
  });

  it('falls back to the default voice when the stored voice is gone', async () => {
    mockChrome({ ttsVoice: 'Uninstalled Voice' });
    await speak(['hello'], 300, noHandlers);
    expect(optionsOf(0).voiceName).toBeUndefined();
  });

  it('reports the spoken word so the reader can follow along', async () => {
    mockChrome({});
    const onProgress = vi.fn();
    await speak(['alpha', 'beta'], 300, { onProgress, onDone: () => {} });

    optionsOf(0).onEvent?.({ type: 'word', charIndex: 6 } as chrome.tts.TtsEvent);

    expect(onProgress).toHaveBeenCalledWith(0, 6);
  });

  it('reports each utterance start, the only sync point engines without word events give', async () => {
    mockChrome({});
    const onProgress = vi.fn();
    const words = Array.from({ length: 900 }, (_, i) => (i % 6 === 5 ? `w${i}.` : `w${i}`));
    await speak(words, 300, { onProgress, onDone: () => {} });

    optionsOf(1).onEvent?.({ type: 'start' } as chrome.tts.TtsEvent);

    expect(onProgress).toHaveBeenCalledWith(1, 0);
  });

  it('queues every utterance so long articles are read to the end', async () => {
    mockChrome({});
    const words = Array.from({ length: 900 }, (_, i) => (i % 6 === 5 ? `w${i}.` : `w${i}`));
    await speak(words, 300, noHandlers);

    expect(speakSpy.mock.calls.length).toBeGreaterThan(1);
    expect(optionsOf(0).enqueue).toBe(false);
    expect(optionsOf(1).enqueue).toBe(true);
  });

  it('reports done once the last utterance ends, not the first', async () => {
    mockChrome({});
    const onDone = vi.fn();
    const words = Array.from({ length: 900 }, (_, i) => (i % 6 === 5 ? `w${i}.` : `w${i}`));
    await speak(words, 300, { onProgress: () => {}, onDone });
    const last = speakSpy.mock.calls.length - 1;

    optionsOf(0).onEvent?.({ type: 'end' } as chrome.tts.TtsEvent);
    expect(onDone).not.toHaveBeenCalled();

    optionsOf(last).onEvent?.({ type: 'end' } as chrome.tts.TtsEvent);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reports done when any utterance is interrupted, cancelled or errors', async () => {
    mockChrome({});
    const onDone = vi.fn();
    await speak(['hello'], 300, { onProgress: () => {}, onDone });
    for (const type of ['start', 'interrupted', 'cancelled', 'error']) {
      optionsOf(0).onEvent?.({ type } as chrome.tts.TtsEvent);
    }
    expect(onDone).toHaveBeenCalledTimes(3);
  });

  it('reports why it could not speak when the browser has no voice', async () => {
    mockChrome({}, []);
    const result = await speak(['hello'], 300, noHandlers);
    expect(result).toEqual({ ok: false, reason: 'No text-to-speech voice is installed in this browser.' });
    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('does not speak an empty request', async () => {
    mockChrome({});
    expect(await speak([], 300, noHandlers)).toEqual({ ok: false, reason: 'Nothing to read aloud.' });
    expect(speakSpy).not.toHaveBeenCalled();
  });
});
