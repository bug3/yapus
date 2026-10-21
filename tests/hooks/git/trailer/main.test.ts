import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const MAIN = join(ROOT, 'hooks', 'git', 'trailer', 'main.ts');
const SUBPROCESS_TIMEOUT_MS = 10000;

test('exits 2 with one line for a missing message file', (t) => {
  const tempDir = makeTempDir(t);

  const hookRun = spawnSync(process.execPath, [MAIN, 'missing'], {
    cwd: tempDir,
    encoding: 'utf8',
    // git words its fatal line in the C locale.
    env: { ...getGitEnv(process.env), LC_ALL: 'C' },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [
      2,
      '',
      "yapus trailer: git interpret-trailers failed: exit 128: fatal: could not read input file 'missing': No such file or directory; the commit is blocked, fix the hook\n",
    ],
  );
});
