import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'providens', 'resume', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const SEND = {
  session_id: 's1',
  tool_name: 'SendMessage',
  tool_input: { to: 'a1', summary: 'Follow-up', message: 'Reply with the single word OK.' },
  tool_response: { success: true, message: 'Resuming agent a1', resumedAgentId: 'a1' },
  tool_use_id: 'toolu_1',
};
const RESUMED = JSON.stringify(SEND);
const QUEUED = JSON.stringify({
  ...SEND,
  tool_response: { success: true, message: 'Message queued for delivery to a1.' },
});

test('exits 0 with no output and writes the row for a resume', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, RESUMED);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(existsSync(join(env.CLAUDE_PLUGIN_DATA ?? '', 'decisions.jsonl')), true);
});

test('exits 0 with no output and no row for a queued message', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, QUEUED);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(existsSync(join(env.CLAUDE_PLUGIN_DATA ?? '', 'decisions.jsonl')), false);
});

test('exits 2 with one line on stderr and no row for each payload it cannot record', (t) => {
  const unsafeSession = JSON.stringify({ ...SEND, session_id: '../x' });
  const unsafeAgent = JSON.stringify({
    ...SEND,
    tool_response: { ...SEND.tool_response, resumedAgentId: 'a/1' },
  });
  const otherTool = JSON.stringify({ ...SEND, tool_name: 'Agent' });
  const cases: readonly [string, string][] = [
    ['{', 'stdin is not JSON'],
    [otherTool, 'tool_name is not SendMessage'],
    [unsafeSession, 'session_id is not letters, digits and hyphens'],
    [unsafeAgent, 'tool_response.resumedAgentId is not letters, digits and hyphens'],
  ];

  for (const [stdinText, reason] of cases) {
    const env = makeHookEnv(t);
    const hookRun = runHook(env, stdinText);

    assert.deepEqual(
      [hookRun.status, hookRun.stderr],
      [2, `yapus providens resume: ${ reason }; the resume is not recorded\n`],
    );
    assert.equal(existsSync(join(env.CLAUDE_PLUGIN_DATA ?? '', 'decisions.jsonl')), false);
  }
});

test('exits 2 with one line on stderr when CLAUDE_PLUGIN_DATA is unset', (t) => {
  const env = { ...makeHookEnv(t), CLAUDE_PLUGIN_DATA: '' };
  const hookRun = runHook(env, RESUMED);

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus providens resume: CLAUDE_PLUGIN_DATA is not set; reinstall the plugin\n'],
  );
});

test('exits 0 through the bash entry point for a resume', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/providens/resume'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: RESUMED,
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
