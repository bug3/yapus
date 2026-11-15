import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'remember', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const ISO_LINE = /^\{"time":"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z","prompt":"go"\}\n$/u;

test('exits 0 with no output and appends the typed prompt to the log', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, makePrompt(String(env.TMPDIR)));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.match(readFileSync(getLogPath(env), 'utf8'), ISO_LINE);
});

// A session that ran cd: the payload's cwd moved, the session's root did not.
test('appends the prompt under CLAUDE_PROJECT_DIR when the payload cwd differs', (t) => {
  const env = makeHookEnv(t);
  const movedDir = makeTempDir(t);
  const hookRun = runHook(env, makePrompt(movedDir));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.match(readFileSync(getLogPath(env), 'utf8'), ISO_LINE);
  assert.equal(existsSync(join(movedDir, '.yapus')), false);
});

test('exits 0 with one line on stderr for stdin it cannot read', (t) => {
  const hookRun = runHook(makeHookEnv(t), '{');

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [0, '', 'yapus providens remember: stdin is not JSON; the prompt is not remembered\n'],
  );
});

test('exits 0 with one line on stderr and writes nothing without a project root', (t) => {
  const env = makeHookEnv(t);

  delete env.CLAUDE_PROJECT_DIR;

  const hookRun = runHook(env, makePrompt(String(env.TMPDIR)));

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [0, '', 1]);
  assert.equal(existsSync(join(String(env.TMPDIR), '.yapus')), false);
});

// The hook runs in the project root here, so a relative root would resolve.
test('exits 0 with one line on stderr and writes nothing for a relative root', (t) => {
  const env: NodeJS.ProcessEnv = { ...makeHookEnv(t), CLAUDE_PROJECT_DIR: '.' };
  const hookRun = runHook(env, makePrompt(String(env.TMPDIR)));

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [0, '', 1]);
  assert.equal(existsSync(join(String(env.TMPDIR), '.yapus')), false);
});

test('exits 0 with one line on stderr when the plugin data directory is unset', (t) => {
  const env = makeHookEnv(t);

  delete env.CLAUDE_PLUGIN_DATA;

  const hookRun = runHook(env, makePrompt(String(env.TMPDIR)));

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [0, '', 1]);
});

// A mode file that exists but cannot be read throws inside the program.
test('exits 0 with one line on stderr when the program crashes', (t) => {
  const env = makeHookEnv(t);

  mkdirSync(join(String(env.CLAUDE_PLUGIN_DATA), 'sessions', 's1.mode'), { recursive: true });

  const hookRun = runHook(env, makePrompt(String(env.TMPDIR)));

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [0, '', 1]);
});

test('exits 0 through the bash entry point and appends the prompt', (t) => {
  const env = makeHookEnv(t);
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/delegator/remember'], {
    encoding: 'utf8',
    env,
    input: makePrompt(String(env.TMPDIR)),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
  assert.match(readFileSync(getLogPath(env), 'utf8'), ISO_LINE);
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

function makePrompt(cwd: string): string {
  return JSON.stringify({ session_id: 's1', cwd, prompt: 'go' });
}

// The lines of text that ends in a newline.
function getLineCount(text: string): number {
  return text.split('\n').length - 1;
}

function getLogPath(env: NodeJS.ProcessEnv): string {
  return join(String(env.TMPDIR), '.yapus', 'prompts', 's1.jsonl');
}

// The caller's environment with HOME, TMPDIR and the project root in the
// test's own directory, and the plugin data directory in another.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return {
    ...process.env,
    HOME: tempDir,
    TMPDIR: tempDir,
    CLAUDE_PROJECT_DIR: tempDir,
    CLAUDE_PLUGIN_DATA: makeTempDir(t),
  };
}
