import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { POLICY_PATH } from '../../../../../hooks/claude/providens/policy/get-context.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'providens', 'policy', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const SESSION_START = JSON.stringify({ session_id: 's1', hook_event_name: 'SessionStart' });
const POLICY_OUTPUT = `${ JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: readFileSync(POLICY_PATH, 'utf8'),
  },
}) }\n`;

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

test('writes nothing and exits 0 when the session file holds off', (t) => {
  const dataDir = makeDataDir(t, { session: 'off' });
  const hookRun = runHook(makeHookEnv(t, dataDir), SESSION_START);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('writes nothing and exits 0 when the global file holds off', (t) => {
  const dataDir = makeDataDir(t, { global: 'off' });
  const hookRun = runHook(makeHookEnv(t, dataDir), SESSION_START);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('writes the policy when the session file holds on over a global off', (t) => {
  const dataDir = makeDataDir(t, { session: 'on', global: 'off' });
  const hookRun = runHook(makeHookEnv(t, dataDir), SESSION_START);

  assert.deepEqual([hookRun.status, hookRun.stdout], [0, POLICY_OUTPUT]);
});

test('writes the policy when no mode file exists', (t) => {
  const hookRun = runHook(makeHookEnv(t, makeDataDir(t, {})), SESSION_START);

  assert.deepEqual([hookRun.status, hookRun.stdout], [0, POLICY_OUTPUT]);
});

test('writes the policy when the mode file is invalid', (t) => {
  const dataDir = makeDataDir(t, { global: 'maybe' });
  const hookRun = runHook(makeHookEnv(t, dataDir), SESSION_START);

  assert.deepEqual([hookRun.status, hookRun.stdout], [0, POLICY_OUTPUT]);
});

test('writes the policy when the session id is unsafe', (t) => {
  const dataDir = makeDataDir(t, { global: 'off' });
  const hookRun = runHook(makeHookEnv(t, dataDir), JSON.stringify({ session_id: '../s1' }));

  assert.deepEqual([hookRun.status, hookRun.stdout], [0, POLICY_OUTPUT]);
});

test('writes the policy when stdin is not JSON', (t) => {
  const dataDir = makeDataDir(t, { global: 'off' });
  const hookRun = runHook(makeHookEnv(t, dataDir), 'not json');

  assert.deepEqual([hookRun.status, hookRun.stdout], [0, POLICY_OUTPUT]);
});

test('writes the policy when the plugin data directory is not set', (t) => {
  const hookRun = runHook(makeHookEnv(t), SESSION_START);

  assert.deepEqual([hookRun.status, hookRun.stdout], [0, POLICY_OUTPUT]);
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

test('writes the policy when the plugin data directory is empty', (t) => {
  const env: NodeJS.ProcessEnv = { ...makeHookEnv(t), CLAUDE_PLUGIN_DATA: '' };

  writeFileSync(join(String(env.TMPDIR), 'mode'), 'off');

  assert.deepEqual([runHook(env, SESSION_START).stdout], [POLICY_OUTPUT]);
});

// A data directory holding the mode files given: the global one and the
// one of session s1.
function makeDataDir(
  t: TestContext,
  modes: { readonly global?: string; readonly session?: string },
): string {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'sessions'));

  if (modes.global !== undefined) {
    writeFileSync(join(dataDir, 'mode'), modes.global);
  }

  if (modes.session !== undefined) {
    writeFileSync(join(dataDir, 'sessions', 's1.mode'), modes.session);
  }

  return dataDir;
}

// The caller's environment with HOME and TMPDIR in the test's own directory
// and CLAUDE_PLUGIN_DATA at dataDir, or without it.
function makeHookEnv(t: TestContext, dataDir?: string): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: tempDir, TMPDIR: tempDir };

  if (dataDir === undefined) {
    delete env.CLAUDE_PLUGIN_DATA;

    return env;
  }

  return { ...env, CLAUDE_PLUGIN_DATA: dataDir };
}
