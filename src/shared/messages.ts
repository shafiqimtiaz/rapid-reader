export const MSG_START = 'rr:start';
export const MSG_STOP = 'rr:stop';
export const MSG_STATS = 'rr:stats';
export const MSG_SETTINGS = 'rr:settings';
export const MSG_OPEN_OPTIONS = 'rr:open-options';
export const MSG_SPEAK = 'rr:speak';
export const MSG_SPEAK_STOP = 'rr:speak-stop';
export const MSG_SPEAK_STATE = 'rr:speak-state';
export const MSG_SPEAK_PROGRESS = 'rr:speak-progress';
export const MSG_TTS_CHECK = 'rr:tts-check';

export interface StartMessage { type: typeof MSG_START; source: 'selection' | 'article'; }
export interface StopMessage { type: typeof MSG_STOP; }
export interface StatsMessage { type: typeof MSG_STATS; words: number; seconds: number; }
export interface SettingsMessage { type: typeof MSG_SETTINGS; settings: unknown; }
export interface OpenOptionsMessage { type: typeof MSG_OPEN_OPTIONS; }
export interface SpeakMessage { type: typeof MSG_SPEAK; words: string[]; wpm: number; }
export interface SpeakProgressMessage { type: typeof MSG_SPEAK_PROGRESS; utterance: number; charIndex: number; }
export interface SpeakStopMessage { type: typeof MSG_SPEAK_STOP; }
export interface SpeakStateMessage { type: typeof MSG_SPEAK_STATE; speaking: boolean; reason?: string; }
export interface TtsCheckMessage { type: typeof MSG_TTS_CHECK; }
export interface TtsCheckReply { available: boolean; }
export type Message = StartMessage | StopMessage | StatsMessage | SettingsMessage | OpenOptionsMessage
  | SpeakMessage | SpeakStopMessage | SpeakStateMessage | SpeakProgressMessage | TtsCheckMessage;
