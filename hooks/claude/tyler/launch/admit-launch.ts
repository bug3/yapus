import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveSetting, type Setting } from '../../providens/settings/resolve-setting.ts';

// Launches a session may make when the person has written no limit: above
// the 37 the busiest measured session made.
export const DEFAULT_LIMIT = 41;

const LIMIT_FILE = 'launch-limit';
const LAUNCHES_DIR = 'launches';
const WHOLE_NUMBER = /^\d+$/;

export const LIMIT: Setting<number> = {
  name: LIMIT_FILE,
  parse: parseWholeNumber,
  fallback: DEFAULT_LIMIT,
};

// Counts the launch against the session's budget and returns undefined, or
// returns why it does not fit. The person sets the budget for every session
// in <dataDir>/launch-limit and for one session in
// <dataDir>/sessions/<sessionId>.launch-limit, which wins; a file that holds
// no whole number refuses.
export function admitLaunch(dataDir: string, sessionId: string): string | undefined {
  const globalPath = join(dataDir, LIMIT_FILE);
  const limit = resolveSetting(dataDir, sessionId, LIMIT);

  if (limit.kind === 'invalid') {
    return `${ limit.path } holds no whole number; the person writes one there, such as 41`;
  }

  const count = countLaunches(dataDir, sessionId);

  if (count >= limit.value) {
    const limitPath = limit.source === 'session'
      ? join(dataDir, 'sessions', `${ sessionId }.${ LIMIT_FILE }`)
      : globalPath;

    return `this session has launched ${ String(count) } subagents, its limit; the person can `
      + `raise it by writing a larger number into ${ limitPath }`;
  }

  const logPath = getLogPath(dataDir, sessionId);

  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, '+\n');

  return undefined;
}

// Counts the launches admitted for the session.
export function countLaunches(dataDir: string, sessionId: string): number {
  const logPath = getLogPath(dataDir, sessionId);

  return existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').length - 1 : 0;
}

function parseWholeNumber(text: string): number | undefined {
  return WHOLE_NUMBER.test(text) ? Number(text) : undefined;
}

function getLogPath(dataDir: string, sessionId: string): string {
  return join(dataDir, LAUNCHES_DIR, `${ sessionId }.log`);
}
