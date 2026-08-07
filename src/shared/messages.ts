export const MSG_START = 'rr:start';
export const MSG_STOP = 'rr:stop';
export const MSG_STATS = 'rr:stats';
export const MSG_SETTINGS = 'rr:settings';

export interface StartMessage { type: typeof MSG_START; source: 'selection' | 'article'; }
export interface StopMessage { type: typeof MSG_STOP; }
export interface StatsMessage { type: typeof MSG_STATS; words: number; seconds: number; }
export interface SettingsMessage { type: typeof MSG_SETTINGS; settings: unknown; }
export type Message = StartMessage | StopMessage | StatsMessage | SettingsMessage;
