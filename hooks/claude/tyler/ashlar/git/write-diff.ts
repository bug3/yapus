import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { DIFF_SETTINGS, type Range } from './get-change.ts';
import { failed, type GitFailure, isFailure, type Place, runGit } from './run-git.ts';

// Writes the diff from range.base to range.tree to path, creating its parent
// directory, and gives true. A git failure comes back as a value and leaves
// path unwritten; a file error is thrown after the temporary file is removed.
export function writeDiff(path: string, place: Place, range: Range): true | GitFailure {
  const args = ['diff', ...DIFF_SETTINGS, range.base, range.tree];
  const run = runGit(args, place);

  if (isFailure(run)) {
    return run;
  }

  if (run.status !== 0) {
    return failed(args, getFirstLine(run.stderr));
  }

  // A rename within one directory is atomic, so a reader of path sees the old
  // diff or the whole new one, never a part.
  const tempPath = `${ path }.${ String(process.pid) }.tmp`;

  mkdirSync(dirname(path), { recursive: true });

  try {
    writeFileSync(tempPath, run.stdout);
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });

    throw error;
  }

  return true;
}
