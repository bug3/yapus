import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

export const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'ordo');

const SUBPROCESS_TIMEOUT_MS = 20000;

// A copy of the plugin with its links followed, as the plugin cache holds it;
// the copy must hold no link, or a test could write through one into the
// repository. Returns the copy's root.
export function copyPlugin(t: TestContext): string {
  const root = join(makeTempDir(t), 'plugin');
  const copyRun = spawnSync('cp', ['-RL', PLUGIN, root], { encoding: 'utf8' });

  assert.equal(copyRun.status, 0, copyRun.stderr);
  assert.deepEqual(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isSymbolicLink())
      .map((entry) => join(entry.parentPath, entry.name)),
    [],
  );

  return root;
}

// The program ordo/repo run through the plugin copy's run.sh on repo,
// with the language argument when one is given.
export function runProject(
  root: string,
  repo: string,
  language?: string,
): SpawnSyncReturns<string> {
  return spawnSync(
    'bash',
    [
      join(root, 'runtime', 'run.sh'),
      'ordo/repo',
      root,
      repo,
      ...language === undefined ? [] : [language],
    ],
    { encoding: 'utf8', env: getGitEnv(process.env), timeout: SUBPROCESS_TIMEOUT_MS },
  );
}
