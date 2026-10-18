import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'claude');
const MAIN = join(HOOKS, 'dashes', 'main.ts');
const RUN_SH = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const EM_DASH = String.fromCodePoint(0x2014);
const DASH_WRITE = JSON.stringify({
  tool_name: 'Write',
  tool_input: { file_path: '/r/a.md', content: EM_DASH },
});

test('exits 2 and writes the finding to stderr for a Write that adds a dash', (t) => {
  const hookRun = runHook(t, DASH_WRITE);

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [2, '', 'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen\n'],
  );
});

test('exits 0 with no output for a Write with only ASCII hyphens', (t) => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: '/r/a.md', content: 'a - b\n' },
  });

  const hookRun = runHook(t, stdinText);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 for stdin that is not JSON', (t) => {
  const hookRun = runHook(t, '{');

  assert.equal(hookRun.status, 2);
});

test('exits 2 through the bash entry point for a Write that adds a dash', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/dashes'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: DASH_WRITE,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, 'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen\n'],
  );
});

function runHook(t: TestContext, stdinText: string) {
  return spawnSync(process.execPath, [MAIN], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// The caller's environment with HOME and TMPDIR in the test's own directory.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return { ...process.env, HOME: tempDir, TMPDIR: tempDir };
}
