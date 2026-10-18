import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { POLICY_PATH } from '../../../../../hooks/claude/providens/policy/get-context.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'providens', 'policy', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;

test('exits 0 and writes the policy as SessionStart context', (t) => {
  const hookRun = spawnSync(process.execPath, [MAIN], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
  assert.deepEqual(JSON.parse(hookRun.stdout), {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: readFileSync(POLICY_PATH, 'utf8'),
    },
  });
});

test('exits 0 through the bash entry point', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/providens/policy'], {
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
