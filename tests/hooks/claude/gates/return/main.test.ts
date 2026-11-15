import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'gates', 'return', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const FIELDS = { session_id: 's1', agent_type: 'delegator:reader' };

test('exits 0 with no output for a return within the cap', (t) => {
  const hookRun = runHook(t, { ...FIELDS, last_assistant_message: 'DONE' });

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 and tells the subagent to shorten a first return over the cap', (t) => {
  const hookRun = runHook(t, { ...FIELDS, last_assistant_message: 'a'.repeat(12001) });

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens return: the return has 12001 characters/);
});

test('exits 0 through the bash entry point for a return within the cap', (t) => {
  const tempDir = makeTempDir(t);
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/gates/return'], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: tempDir },
    input: JSON.stringify({ ...FIELDS, last_assistant_message: 'DONE' }),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
});

// In the test's own directory, with HOME, TMPDIR and the plugin data
// directory there, so the hook writes nothing into the repository.
function runHook(t: TestContext, fields: object) {
  const tempDir = makeTempDir(t);

  return spawnSync(process.execPath, [MAIN], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: tempDir },
    input: JSON.stringify(fields),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
