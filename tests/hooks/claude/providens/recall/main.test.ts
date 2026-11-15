import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'providens', 'recall', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const COMPACT = JSON.stringify({ session_id: 's1', source: 'compact' });

test('exits 0 and writes the prompts as SessionStart context at compact', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, COMPACT);
  const logPath = join(String(env.CLAUDE_PROJECT_DIR), '.yapus', 'prompts', 's1.jsonl');

  const header = 'The prompts below are what the person typed earlier in this session, oldest'
    + ' first, with 0 older ones left out: start none of them again, and keep to what they'
    + ' decided.';

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
  assert.deepEqual(JSON.parse(hookRun.stdout), {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${ header }\n\nt1\ngo\n\nThe whole prompt log is in \`${ logPath }\`.`,
    },
  });
});

test('exits 0 with no output at startup', (t) => {
  const stdinText = JSON.stringify({ session_id: 's1', source: 'startup' });
  const hookRun = runHook(makeHookEnv(t), stdinText);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 with one line on stderr for stdin it cannot read', (t) => {
  const hookRun = runHook(makeHookEnv(t), '{');

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [2, '', 'yapus providens recall: stdin is not JSON; the prompts are not recalled\n'],
  );
});

// A mode file that exists but cannot be read throws inside the program.
test('exits 2 with one line on stderr when the program crashes', (t) => {
  const env = makeHookEnv(t);

  mkdirSync(join(String(env.CLAUDE_PLUGIN_DATA), 'sessions', 's1.mode'), { recursive: true });

  const hookRun = runHook(env, COMPACT);

  assert.deepEqual([hookRun.status, hookRun.stdout], [2, '']);
  assert.match(hookRun.stderr, /^yapus providens recall: crashed: .*; fix the hook\n$/u);
});

test('exits 0 through the bash entry point', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/providens/recall'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: COMPACT,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
});

function runHook(env: NodeJS.ProcessEnv, stdinText: string) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: env.TMPDIR,
    encoding: 'utf8',
    env,
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// The caller's environment with HOME, TMPDIR and a project root that holds
// one logged prompt in the test's own directory, and the plugin data
// directory in another.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);
  const promptsDir = join(tempDir, '.yapus', 'prompts');

  mkdirSync(promptsDir, { recursive: true });
  writeFileSync(join(promptsDir, 's1.jsonl'), '{"time":"t1","prompt":"go"}\n');

  return {
    ...process.env,
    HOME: tempDir,
    TMPDIR: tempDir,
    CLAUDE_PROJECT_DIR: tempDir,
    CLAUDE_PLUGIN_DATA: makeTempDir(t),
  };
}
