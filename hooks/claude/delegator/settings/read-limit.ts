import { resolveSetting, type ResolvedSetting, type Setting } from './resolve-setting.ts';

// Launches admitted in a session when the person has written no limit: above
// the 53 launched in the busiest measured session.
export const DEFAULT_LIMIT = 60;

const WHOLE_NUMBER = /^\d+$/;

export const LIMIT: Setting<number> = {
  name: 'launch-limit',
  parse: parseWholeNumber,
  fallback: DEFAULT_LIMIT,
};

// The launch limit in force for the session: the person's <dataDir>/sessions/
// <sessionId>.launch-limit, else <dataDir>/launch-limit, else DEFAULT_LIMIT. A
// file that holds no whole number is returned invalid.
export function readLimit(dataDir: string, sessionId: string): ResolvedSetting<number> {
  return resolveSetting(dataDir, sessionId, LIMIT);
}

function parseWholeNumber(text: string): number | undefined {
  return WHOLE_NUMBER.test(text) ? Number(text) : undefined;
}
