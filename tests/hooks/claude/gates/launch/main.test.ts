import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeMemoryProject } from '../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import type { TempFile } from '../../../../helpers/make-temp-repo.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'gates', 'launch', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const CALL = {
  session_id: 's1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'delegator:reader', description: '[deep] Find x' },
};
const FINISHER_CALL = {
  ...CALL,
  tool_input: { subagent_type: 'delegator:finisher', description: '[deep] Finish S1' },
};
const FINISHER_RULE = '---\ndescription: "About a."\nevent: "launch delegator:finisher"\n---\n';
const HEADING_A = 'Project memory, .yapus/memory/rules/a.md applies to this call:';
const HEADING_B = 'Project memory, .yapus/memory/rules/b.md applies to this call:';

test('exits 0 with no output for a roster launch', (t) => {
  const hookRun = runHook(makeHookEnv(t), JSON.stringify(CALL));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 and names the reason for a nested launch', (t) => {
  const hookRun = runHook(makeHookEnv(t), JSON.stringify({ ...CALL, agent_id: 'a1' }));

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus delegator launch: '
      + 'a subagent launches no subagent; return the work to your launcher\n'],
  );
});

test('exits 2 and says so when the plugin data directory is not set', (t) => {
  const hookRun = runHook({ ...makeHookEnv(t), CLAUDE_PLUGIN_DATA: '' }, JSON.stringify(CALL));

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus delegator launch: CLAUDE_PLUGIN_DATA is not set; reinstall the plugin\n'],
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

test('hands an allowed launch the rule that names its agent type', (t) => {
  const env = makeProjectEnv(t, [{ path: 'rules/a.md', text: `${ FINISHER_RULE }\nSay a.\n` }]);
  const hookRun = runHook(env, JSON.stringify(FINISHER_CALL));

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [0, makeOutput(`${ HEADING_A }\nSay a.`), ''],
  );
});

test('hands a later launch of the session the rule as its line', (t) => {
  const env = makeProjectEnv(t, [{ path: 'rules/a.md', text: `${ FINISHER_RULE }\nSay a.\n` }]);

  runHook(env, JSON.stringify(FINISHER_CALL));

  const hookRun = runHook(env, JSON.stringify(FINISHER_CALL));

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [0, makeOutput(`${ HEADING_A } About a. Read the file.`), ''],
  );
});

test('hands nothing to a launch of an agent type the rule does not name', (t) => {
  const env = makeProjectEnv(t, [{ path: 'rules/a.md', text: `${ FINISHER_RULE }\nSay a.\n` }]);
  const hookRun = runHook(env, JSON.stringify(CALL));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 with the reason alone for a refused launch that a rule names', (t) => {
  const env = makeProjectEnv(t, [{ path: 'rules/a.md', text: `${ FINISHER_RULE }\nSay a.\n` }]);
  const hookRun = runHook(env, JSON.stringify({ ...FINISHER_CALL, agent_id: 'a1' }));

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [2, '', 'yapus delegator launch: '
      + 'a subagent launches no subagent; return the work to your launcher\n'],
  );
});

test('hands nothing in a session switched off', (t) => {
  const env = makeProjectEnv(t, [{ path: 'rules/a.md', text: `${ FINISHER_RULE }\nSay a.\n` }]);

  writeFileSync(join(env.CLAUDE_PLUGIN_DATA ?? '', 'mode'), 'off');

  const hookRun = runHook(env, JSON.stringify(FINISHER_CALL));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('hands no rule that names its successor', (t) => {
  const replaced = '---\ndescription: "About a."\nevent: "launch delegator:finisher"\n'
    + 'superseded-by: "b"\n---\n\nSay a.\n';
  const env = makeProjectEnv(t, [
    { path: 'rules/a.md', text: replaced },
    { path: 'rules/b.md', text: '---\ndescription: "About b."\n---\n\nSay b.\n' },
  ]);
  const hookRun = runHook(env, JSON.stringify(FINISHER_CALL));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('hands the third of three rules as its line when their bodies pass 8,000 characters', (t) => {
  const env = makeProjectEnv(t, [
    { path: 'rules/a.md', text: `${ FINISHER_RULE }\n${ 'a'.repeat(3000) }\n` },
    { path: 'rules/b.md', text: `${ FINISHER_RULE }\n${ 'b'.repeat(3000) }\n` },
    { path: 'rules/c.md', text: `${ FINISHER_RULE }\n${ 'c'.repeat(3000) }\n` },
  ]);
  const hookRun = runHook(env, JSON.stringify(FINISHER_CALL));

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [
      0,
      makeOutput(
        `${ HEADING_A }\n${ 'a'.repeat(3000) }\n\n${ HEADING_B }\n${ 'b'.repeat(3000) }\n\n`
        + 'Project memory, .yapus/memory/rules/c.md applies to this call: About a. Read the file.',
      ),
      '',
    ],
  );
});

test('exits 0 with no output where a file stands in the place of rules', (t) => {
  const hookRun = runHook(
    makeProjectEnv(t, [{ path: 'rules', text: 'x' }]),
    JSON.stringify(FINISHER_CALL),
  );

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 0 with no output where a file stands in the place of the memory directory', (t) => {
  const env = makeHookEnv(t);

  mkdirSync(join(env.CLAUDE_PROJECT_DIR ?? '', '.yapus'));
  writeFileSync(join(env.CLAUDE_PROJECT_DIR ?? '', '.yapus', 'memory'), 'x');

  const hookRun = runHook(env, JSON.stringify(FINISHER_CALL));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 0 with no error line when the rule cannot be written to stdout', (t) => {
  const env = makeProjectEnv(t, [{ path: 'rules/a.md', text: `${ FINISHER_RULE }\nSay a.\n` }]);
  // Open for reading alone, so a write to it fails.
  const unwritable = openSync(join(env.CLAUDE_PROJECT_DIR ?? '', '.yapus'), 'r');

  t.after(() => {
    closeSync(unwritable);
  });

  const hookRun = spawnSync(process.execPath, [MAIN], {
    cwd: env.TMPDIR,
    encoding: 'utf8',
    env,
    input: JSON.stringify(FINISHER_CALL),
    stdio: ['pipe', unwritable, 'pipe'],
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
});

// The line the hook prints to hand the text over.
function makeOutput(additionalContext: string): string {
  const output = { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } };

  return `${ JSON.stringify(output) }\n`;
}

// The hook's environment with a project of its own whose memory holds the files.
function makeProjectEnv(t: TestContext, files: readonly TempFile[]): NodeJS.ProcessEnv {
  return { ...makeHookEnv(t), CLAUDE_PROJECT_DIR: makeMemoryProject(t, files) };
}

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

// The caller's environment with HOME, TMPDIR, the config directory, the plugin
// data directory and the project directory in the test's own directory, so
// the hook reads nothing of the session that runs the test.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return {
    ...process.env,
    HOME: tempDir,
    TMPDIR: tempDir,
    CLAUDE_CONFIG_DIR: tempDir,
    CLAUDE_PLUGIN_DATA: tempDir,
    CLAUDE_PROJECT_DIR: tempDir,
  };
}
