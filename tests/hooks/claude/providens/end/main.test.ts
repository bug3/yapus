import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'providens', 'end', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const END = JSON.stringify({
  session_id: 's1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'providens:runner', description: '[standard] run it' },
  tool_response: { status: 'completed', agentId: 'a1' },
});

test('exits 0 with no output and writes the row for an ended launch', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, END);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(existsSync(join(env.CLAUDE_PLUGIN_DATA ?? '', 'decisions.jsonl')), true);
});

test('exits 2 and names the reason for stdin it cannot read', (t) => {
  const hookRun = runHook(makeHookEnv(t), '{');

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus providens end: stdin is not JSON; the end is not recorded\n'],
  );
});

test('exits 0 through the bash entry point for an ended launch', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/providens/end'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: END,
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
