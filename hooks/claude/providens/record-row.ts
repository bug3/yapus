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

// The return verdict with the subagent's id (joins its transcript and meta
// file), the first word of the return (the status the contract asks for),
// the first word of the next line (the verdict a judge puts there) and the
// return's length in characters. The totals are the subagent transcript's,
// undefined when the payload names no transcript or the file cannot be read.
export interface ReturnRow extends Decision {
  readonly hook: 'return';
  readonly agentId: string | undefined;
  readonly status: string;
  readonly verdict: string | undefined;
  readonly length: number;
  readonly turns: number | undefined;
  readonly toolUses: number | undefined;
  readonly tokens: number | undefined;
  readonly durationMs: number | undefined;
  readonly model: string | undefined;
}

// What the Agent tool reported when a launch ended: the keys that join the
// launch row and the subagent's files, and the totals a completed launch
// carries (a background launch is reported at once, without them).
export interface EndRow extends Base {
  readonly hook: 'end';
  readonly promptId: string | undefined;
  readonly toolUseId: string | undefined;
  readonly agentId: string;
  readonly status: string;
  readonly model: string | undefined;
  readonly durationMs: number | undefined;
  readonly tokens: number | undefined;
  readonly toolUses: number | undefined;
  readonly word: string | undefined;
  readonly length: number | undefined;
  readonly capped: boolean;
}

// A SendMessage that resumed a subagent that had stopped: the resumed agent's
// id (joins the end and return rows) and the call id. It names no agent type,
// so it has no subject: the report joins it to its launch through the agent id.
export interface ResumeRow {
  readonly time: string;
  readonly hook: 'resume';
  readonly sessionId: string;
  readonly agentId: string;
  readonly toolUseId: string;
}

export type Row = LaunchRow | ReturnRow | EndRow | ResumeRow;

export const RECORD_FILE = 'decisions.jsonl';

// Appends the row as one JSON line to <dataDir>/RECORD_FILE, the record the
// plugin's numbers are tuned from.
export function recordRow(dataDir: string, row: Row): void {
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(join(dataDir, RECORD_FILE), `${ JSON.stringify(row) }\n`);
}
