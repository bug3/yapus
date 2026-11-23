import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isRecord } from '../../../../shared/is-record.ts';
import { isSafeId } from '../../../../shared/is-safe-id.ts';

const HANDOVERS_DIR = 'handovers';

// The file that holds the rules whose bodies the session of the payload was
// handed, <dataDir>/handovers/<sessionId>.log with one rule path a line,
// beside the session's launch record; undefined when the data directory is
// not set or the payload names no session whose id is safe as a file name.
export function getRecordPath(stdinText: string, dataDir: string | undefined): string | undefined {
  const sessionId = getSessionId(stdinText);

  return dataDir === undefined || dataDir === '' || sessionId === undefined
    ? undefined
    : join(dataDir, HANDOVERS_DIR, `${ sessionId }.log`);
}

// The paths in the record; none for a record that is not there or cannot be
// read, so that the body of every rule is handed.
export function readHanded(recordPath: string | undefined): ReadonlySet<string> {
  if (recordPath === undefined) {
    return new Set();
  }

  try {
    return new Set(readFileSync(recordPath, 'utf8').split('\n'));
  } catch {
    return new Set();
  }
}

// Adds the paths to the record. One that cannot be written is left as it is:
// the next call hands the bodies again.
export function recordHanded(recordPath: string | undefined, paths: readonly string[]): void {
  if (recordPath === undefined || paths.length === 0) {
    return;
  }

  try {
    mkdirSync(dirname(recordPath), { recursive: true });
    appendFileSync(recordPath, paths.map((path) => `${ path }\n`).join(''));
  } catch {
    // Nothing is recorded.
  }
}

function getSessionId(stdinText: string): string | undefined {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return undefined;
  }

  return isRecord(payload) && isSafeId(payload.session_id) ? payload.session_id : undefined;
}
