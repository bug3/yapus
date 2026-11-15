import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'contract', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;

test('exits 0 and writes the contract as SubagentStart context', (t) => {
  const hookRun = spawnSync(process.execPath, [MAIN], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
  assert.match(hookRun.stdout, /"hookEventName":"SubagentStart".*within 12000 characters/);
});

test('exits 0 through the bash entry point', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/delegator/contract'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
});

// The caller's environment with HOME and TMPDIR in the test's own directory.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return { ...process.env, HOME: tempDir, TMPDIR: tempDir };
}
