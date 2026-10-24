import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// What every row of the record carries: the time, the session and the agent
// type it is about.
interface Base {
  readonly time: string;
  readonly sessionId: string;
  readonly subject: string;
}

// A hook's verdict on a launch or on a return.
export interface Decision extends Base {
  readonly hook: 'launch' | 'return';
  readonly allowed: boolean;
  readonly reason: string;
}

export type Row = Decision;

export const RECORD_FILE = 'decisions.jsonl';

// Appends the row as one JSON line to <dataDir>/RECORD_FILE, the record the
// plugin's numbers are tuned from.
export function recordRow(dataDir: string, row: Row): void {
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(join(dataDir, RECORD_FILE), `${ JSON.stringify(row) }\n`);
}
