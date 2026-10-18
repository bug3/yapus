import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Decision {
  readonly time: string;
  readonly hook: string;
  readonly sessionId: string;
  readonly subject: string;
  readonly allowed: boolean;
  readonly reason: string;
}

const LOG_FILE = 'decisions.jsonl';

// Appends the decision as one JSON line to <dataDir>/decisions.jsonl, the
// record its numbers are tuned from.
export function logDecision(dataDir: string, decision: Decision): void {
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(join(dataDir, LOG_FILE), `${ JSON.stringify(decision) }\n`);
}
