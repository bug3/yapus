import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getOutput, type GitFailure, isFailure, type Place } from './run-git.ts';

const TEMP_PREFIX = 'yapus-ashlar-';

// The working tree at root as a tree id, untracked files included and ignored
// files excluded. It is built in a copy of the index, so the real index file
// stays untouched; place.cwd is where the real index is looked up.
export function getWorkingTree(root: string, place: Place): string | GitFailure {
  const indexPath = getOutput(['rev-parse', '--git-path', 'index'], place);

  if (isFailure(indexPath)) {
    return indexPath;
  }

  const tempDir = mkdtempSync(join(tmpdir(), TEMP_PREFIX));

  try {
    const copy = join(tempDir, 'index');
    const realIndex = resolve(place.cwd, indexPath);

    // The copy lets git reuse the real index's stat cache.
    if (existsSync(realIndex)) {
      copyFileSync(realIndex, copy);
    }

    const atRoot: Place = { cwd: root, env: { ...place.env, GIT_INDEX_FILE: copy } };
    const added = getOutput(['add', '-A'], atRoot);

    return isFailure(added) ? added : getOutput(['write-tree'], atRoot);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
