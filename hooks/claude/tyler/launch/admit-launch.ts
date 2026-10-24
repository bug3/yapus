import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Launches a session may make when the person has written no limit: above
// the 37 the busiest measured session made.
export const DEFAULT_LIMIT = 41;

const LIMIT_FILE = 'launch-limit';
const LAUNCHES_DIR = 'launches';
const WHOLE_NUMBER = /^\d+$/;

// Counts the launch against the session's budget and returns undefined, or
// returns why it does not fit. The person sets the budget for every session
// in <dataDir>/launch-limit; a file that holds no whole number refuses.
export function admitLaunch(dataDir: string, sessionId: string): string | undefined {
  const limitPath = join(dataDir, LIMIT_FILE);
  const limit = readLimit(limitPath);

  if (limit === undefined) {
    return `${ limitPath } holds no whole number; the person writes one there, such as 41`;
  }

  const logPath = join(dataDir, LAUNCHES_DIR, `${ sessionId }.log`);
  const count = countLaunches(logPath);

  if (count >= limit) {
    return `this session has launched ${ String(count) } subagents, its limit; the person can `
      + `raise it by writing a larger number into ${ limitPath }`;
  }

  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, '+\n');

  return undefined;
}

function readLimit(path: string): number | undefined {
  if (!existsSync(path)) {
    return DEFAULT_LIMIT;
  }

  const text = readFileSync(path, 'utf8').trim();

  return WHOLE_NUMBER.test(text) ? Number(text) : undefined;
}

function countLaunches(path: string): number {
  return existsSync(path) ? readFileSync(path, 'utf8').split('\n').length - 1 : 0;
}
