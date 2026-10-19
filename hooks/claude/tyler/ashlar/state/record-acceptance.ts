import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getStatePath } from './get-state-path.ts';

export const ACCEPTANCES_SUFFIX = '.jsonl';

export interface Acceptance {
  readonly time: string;
  readonly agentId: string;
  readonly base: string;
  readonly tree: string;
}

// Appends the acceptance as one JSON line to <dataDir>/ashlar/<sessionId>.jsonl.
// It binds the reviewer's yes to a base and a tree, so any later edit changes
// the tree and drops the acceptance.
export function recordAcceptance(
  dataDir: string,
  sessionId: string,
  acceptance: Acceptance,
): void {
  const path = getStatePath(dataDir, `${ sessionId }${ ACCEPTANCES_SUFFIX }`);

  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${ JSON.stringify(acceptance) }\n`);
}
