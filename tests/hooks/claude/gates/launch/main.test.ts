import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'gates', 'launch', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const CALL = {
  session_id: 's1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'delegator:reader', description: '[deep] Find x' },
};

test('exits 0 with no output for a roster launch', (t) => {
  const hookRun = runHook(makeHookEnv(t), JSON.stringify(CALL));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 and names the reason for a nested launch', (t) => {
  const hookRun = runHook(makeHookEnv(t), JSON.stringify({ ...CALL, agent_id: 'a1' }));

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus providens launch: a subagent launches no agents; return the work to your caller\n'],
  );
});

test('exits 2 and says so when the plugin data directory is not set', (t) => {
  const hookRun = runHook({ ...makeHookEnv(t), CLAUDE_PLUGIN_DATA: '' }, JSON.stringify(CALL));

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus providens launch: CLAUDE_PLUGIN_DATA is not set; reinstall the plugin\n'],
  );
});

test('exits 0 through the bash entry point for a roster launch', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/gates/launch'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: JSON.stringify(CALL),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
});

// In the test's own directory, so a hook that takes an empty data directory
// for the working directory writes nothing into the repository.
function runHook(env: NodeJS.ProcessEnv, stdinText: string) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: env.TMPDIR,
    encoding: 'utf8',
    env,
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// The caller's environment with HOME, TMPDIR and the plugin data directory
// in the test's own directory.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: tempDir };
}
