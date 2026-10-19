import { existsSync, readFileSync } from 'node:fs';
import type { Range } from '../git/get-change.ts';
import { getStatePath } from './get-state-path.ts';
import { ACCEPTANCES_SUFFIX } from './record-acceptance.ts';

// True when <dataDir>/ashlar/<sessionId>.jsonl holds a line accepting exactly
// this base and tree; an edit changes the tree, so it drops the acceptance. A
// missing file is false, and a line that is no object with a string base and
// tree is skipped.
export function isAccepted(dataDir: string, sessionId: string, range: Range): boolean {
  const path = getStatePath(dataDir, `${ sessionId }${ ACCEPTANCES_SUFFIX }`);

  if (!existsSync(path)) {
    return false;
  }

  return readFileSync(path, 'utf8')
    .split('\n')
    .some((line) => isLineFor(line, range));
}

function isLineFor(line: string, range: Range): boolean {
  const parsed = parseLine(line);

  return typeof parsed === 'object'
    && parsed !== null
    && 'base' in parsed
    && 'tree' in parsed
    && parsed.base === range.base
    && parsed.tree === range.tree;
}

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}
