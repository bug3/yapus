import { resolveSetting, type ResolvedSetting, type Setting } from './resolve-setting.ts';

export type Mode = 'on' | 'off';

export const MODE: Setting<Mode> = { name: 'mode', parse: parseMode, fallback: 'on' };

// The mode in force for the session: the person's <dataDir>/sessions/
// <sessionId>.mode, else <dataDir>/mode, else on. A file that holds neither
// on nor off is returned invalid.
export function readMode(dataDir: string, sessionId: string): ResolvedSetting<Mode> {
  return resolveSetting(dataDir, sessionId, MODE);
}

function parseMode(text: string): Mode | undefined {
  return text === 'on' || text === 'off' ? text : undefined;
}
