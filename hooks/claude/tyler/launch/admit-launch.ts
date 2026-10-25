import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readLimit } from '../../providens/settings/read-limit.ts';

const LAUNCHES_DIR = 'launches';

// Counts the launch against the session's budget and returns undefined, or
// returns why it does not fit. The person sets the budget for every session
// in <dataDir>/launch-limit and for one session in
// <dataDir>/sessions/<sessionId>.launch-limit, which wins; a file that holds
// no whole number refuses.
export function admitLaunch(dataDir: string, sessionId: string): string | undefined {
  const limit = readLimit(dataDir, sessionId);

  if (limit.kind === 'invalid') {
    return `${ limit.path } holds no whole number; the person writes one there, such as 41`;
  }

  const count = countLaunches(dataDir, sessionId);

  if (count >= limit.value) {
    return `this session has launched ${ String(count) } subagents, its limit; the person can `
      + `raise it by writing a larger number into ${ limit.path }`;
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

function getLogPath(dataDir: string, sessionId: string): string {
  return join(dataDir, LAUNCHES_DIR, `${ sessionId }.log`);
}
