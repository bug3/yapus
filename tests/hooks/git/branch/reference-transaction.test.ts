import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const HOOK = join(ROOT, 'hooks', 'git', 'reference-transaction');
const SUBPROCESS_TIMEOUT_MS = 10000;
const BASH = execFileSync('/bin/sh', ['-c', 'command -v bash'], {
  encoding: 'utf8',
  timeout: SUBPROCESS_TIMEOUT_MS,
}).trim();
const EXECUTE_BITS = 0o111;
// A malformed line the branch check would refuse, so a pass shows Node never ran.
const MALFORMED_CREATION = '0000000000000000000000000000000000000000 x refs/heads/bad\n';
const AGENT: NodeJS.ProcessEnv = { CLAUDECODE: '1' };
const PERSON: NodeJS.ProcessEnv = {};

interface HookRun {
  readonly state: string;
  readonly who: NodeJS.ProcessEnv;
}

test('lets a transaction through at a state other than prepared', (t) => {
  const hookRun = runHook(t, { state: 'preparing', who: AGENT });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
});

test('lets a person\'s transaction through without the branch check', (t) => {
  const hookRun = runHook(t, { state: 'prepared', who: PERSON });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
});

test('passes an agent\'s possible branch creation to the branch check', (t) => {
  const hookRun = runHook(t, { state: 'prepared', who: AGENT });

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus branch: ref line 1 is not /);
});

test('is executable, since git skips a hook that is not', () => {
  assert.notEqual(statSync(HOOK).mode & EXECUTE_BITS, 0);
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [HOOK], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});

// The hook run as git runs it, with the state and one ref line that would
// create refs/heads/bad; getGitEnv drops the caller's CLAUDECODE.
function runHook(t: TestContext, { state, who }: HookRun) {
  const tempDir = makeTempDir(t);

  return spawnSync(BASH, [HOOK, state], {
    cwd: tempDir,
    encoding: 'utf8',
    input: MALFORMED_CREATION,
    env: { ...getGitEnv(process.env), HOME: tempDir, TMPDIR: tempDir, ...who },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
