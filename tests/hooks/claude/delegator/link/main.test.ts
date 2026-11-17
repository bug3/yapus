import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'link', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const PROMPT_LINE = '{"time":"2026-11-15T10:00:00.000Z","prompt":"go"}\n';
const PLAN_FILE = join('.yapus', 'plans', '2026-11', 'topic', 'S1.md');
const LOGGED = /^\{"time":"2026-11-15T10:00:00\.000Z","prompt":"go"\}\n\{"time":"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z","plan":"2026-11\/topic","file":"S1\.md"\}\n$/u;

test('exits 0 with no output and appends the plan line of a Write', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);
  const hookRun = runHook(env, makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE)));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.match(readFileSync(logPath, 'utf8'), LOGGED);
});

test('exits 0 with no output and appends the plan line of an Edit', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);
  const hookRun = runHook(env, makeEdit(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE)));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.match(readFileSync(logPath, 'utf8'), LOGGED);
});

test('exits 0 with no output and appends nothing for a second write of the file', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);
  const stdinText = makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE));

  runHook(env, stdinText);

  const hookRun = runHook(env, stdinText);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.match(readFileSync(logPath, 'utf8'), LOGGED);
});

test('exits 0 with no output and appends nothing for a file that is no plan file', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);
  const oldShape = join(String(env.CLAUDE_PROJECT_DIR), '.yapus', 'plans', 'topic.md');
  const hookRun = runHook(env, makeWrite(oldShape));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE);
});

// The hook runs in the project root, named here as the working directory
// reports it, so a relative path would resolve to the plan file.
test('exits 0 with no output and appends nothing for a relative path', (t) => {
  const hookEnv = makeHookEnv(t);
  const projectRoot = realpathSync(String(hookEnv.TMPDIR));
  const env = { ...hookEnv, TMPDIR: projectRoot, CLAUDE_PROJECT_DIR: projectRoot };
  const logPath = writeLog(env);
  const hookRun = runHook(env, makeWrite(PLAN_FILE));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE);
});

test('exits 0 with no output and creates nothing for a session without a file', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE)));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(existsSync(join(String(env.CLAUDE_PROJECT_DIR), '.yapus')), false);
});

test('exits 0 with no output and appends nothing when the session is switched off', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);

  mkdirSync(join(String(env.CLAUDE_PLUGIN_DATA), 'sessions'));
  writeFileSync(join(String(env.CLAUDE_PLUGIN_DATA), 'sessions', 's1.mode'), 'off');

  const hookRun = runHook(env, makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE)));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE);
});

test('exits 2 with one line on stderr for stdin it cannot read', (t) => {
  const hookRun = runHook(makeHookEnv(t), '{');

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [2, '', 'yapus delegator link: stdin is not JSON; the plan line is not written\n'],
  );
});

test('exits 2 with one line on stderr and appends nothing without a project root', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);
  const stdinText = makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE));

  delete env.CLAUDE_PROJECT_DIR;

  const hookRun = runHook(env, stdinText);

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [2, '', 1]);
  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE);
});

test('exits 2 with one line on stderr when the plugin data directory is unset', (t) => {
  const env = makeHookEnv(t);
  const stdinText = makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE));

  delete env.CLAUDE_PLUGIN_DATA;

  const hookRun = runHook(env, stdinText);

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [2, '', 1]);
});

// A mode file that exists but cannot be read throws inside the program.
test('exits 2 with one line on stderr when the program crashes', (t) => {
  const env = makeHookEnv(t);
  const stdinText = makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE));

  mkdirSync(join(String(env.CLAUDE_PLUGIN_DATA), 'sessions', 's1.mode'), { recursive: true });

  const hookRun = runHook(env, stdinText);

  assert.deepEqual([hookRun.status, hookRun.stdout, getLineCount(hookRun.stderr)], [2, '', 1]);
});

test('exits 0 through the bash entry point and appends the plan line', (t) => {
  const env = makeHookEnv(t);
  const logPath = writeLog(env);
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/delegator/link'], {
    encoding: 'utf8',
    env,
    input: makeWrite(join(String(env.CLAUDE_PROJECT_DIR), PLAN_FILE)),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stdout, entryRun.stderr], [0, '', '']);
  assert.match(readFileSync(logPath, 'utf8'), LOGGED);
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

// The file the first logged prompt of session s1 created, with that prompt.
function writeLog(env: NodeJS.ProcessEnv): string {
  const monthDirectory = join(String(env.TMPDIR), '.yapus', 'sessions', '2026-11');
  const logPath = join(monthDirectory, '15T10-00-00Z_s1.jsonl');

  mkdirSync(monthDirectory, { recursive: true });
  writeFileSync(logPath, PROMPT_LINE);

  return logPath;
}

function makeWrite(filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'a' },
  });
}

function makeEdit(filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'a', new_string: 'b', replace_all: false },
  });
}

// The lines of text that ends in a newline.
function getLineCount(text: string): number {
  return text.split('\n').length - 1;
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
