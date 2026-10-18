import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import type { Range } from './get-change.ts';
import { failed, type GitFailure, isFailure, type Place, runGit } from './run-git.ts';

// Writes the diff from range.base to range.tree to path, creating its parent
// directory, and gives true. A git failure comes back as a value and leaves
// path unwritten.
export function writeDiff(path: string, place: Place, range: Range): true | GitFailure {
  const args = ['diff', '--no-renames', range.base, range.tree];
  const run = runGit(args, place);

  if (isFailure(run)) {
    return run;
  }

  if (run.status !== 0) {
    return failed(args, getFirstLine(run.stderr));
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, run.stdout);

  return true;
}
