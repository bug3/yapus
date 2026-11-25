import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { getGitEnv } from '../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CHECK_NAMES = join(ROOT, 'hooks', 'ordo', 'repo', 'files', 'check-names.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;

test('names every kept path as the name check requires', () => {
  const checkRun = spawnSync('bash', [CHECK_NAMES], {
    cwd: ROOT,
    encoding: 'utf8',
    env: getGitEnv(process.env),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([checkRun.status, checkRun.stderr], [0, '']);
});
