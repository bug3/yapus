import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Range } from '../git/get-change.ts';
import { getStatePath } from '../state/get-state-path.ts';

export const REVIEW_SUFFIX = '.review';

// Where a reviewer's start record lives: <dataDir>/ashlar/<sessionId>/<sha256
// hex of agentId>.review. It builds the path and writes nothing.
export function getReviewPath(dataDir: string, sessionId: string, agentId: string): string {
  const agentName = createHash('sha256').update(agentId).digest('hex');

  return getStatePath(dataDir, `${ sessionId }/${ agentName }${ REVIEW_SUFFIX }`);
}

// Writes the base and tree the reviewer was shown as JSON to path, creating
// its parent directory.
export function recordReview(path: string, range: Range): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ base: range.base, tree: range.tree }));
}
