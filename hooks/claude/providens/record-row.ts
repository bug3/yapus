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
interface Decision extends Base {
  readonly allowed: boolean;
  readonly reason: string;
}

// The launch verdict with the description and the keys the payload carries:
// the call id (joins the subagent's meta file), the prompt id (groups the
// launches of one prompt), the model override and the effort level. A key
// the payload lacks is undefined and left out of the line.
export interface LaunchRow extends Decision {
  readonly hook: 'launch';
  readonly description: string;
  readonly toolUseId: string | undefined;
  readonly promptId: string | undefined;
  readonly model: string | undefined;
  readonly effort: string | undefined;
}

export interface ReturnRow extends Decision {
  readonly hook: 'return';
}

export type Row = LaunchRow | ReturnRow;

export const RECORD_FILE = 'decisions.jsonl';

// Appends the row as one JSON line to <dataDir>/RECORD_FILE, the record the
// plugin's numbers are tuned from.
export function recordRow(dataDir: string, row: Row): void {
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(join(dataDir, RECORD_FILE), `${ JSON.stringify(row) }\n`);
}
