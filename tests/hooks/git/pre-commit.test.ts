import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getGitEnv } from '../../helpers/run-git.ts';
import {
  CLEAN_ANSWER,
  type FakeAnswer,
  makeFakeScanner,
} from '../../helpers/scanner/make-fake-scanner.ts';
import { makeToolDir } from '../../helpers/scanner/make-tool-dir.ts';
import { withScanner } from '../../helpers/scanner/with-scanner.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const PRE_COMMIT = join(ROOT, 'hooks', 'git', 'pre-commit');
const SUBPROCESS_TIMEOUT_MS = 60000;
const BASH = execFileSync('/bin/sh', ['-c', 'command -v bash'], {
  encoding: 'utf8',
  timeout: SUBPROCESS_TIMEOUT_MS,
}).trim();
const EXECUTE_BITS = 0o111;
const REPORT = '[{"RuleID":"aws-access-token","File":"a.env","StartLine":4,"Secret":"REDACTED"}]';

test('lets a commit through when the scan finds nothing', (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  const hookRun = runPreCommit(t, withScanner(getGitEnv(process.env), scanner));

  assert.deepEqual([hookRun.status, hookRun.stderr, scanner.readCalls().length], [0, '', 1]);
});

test('refuses a commit whose staged change holds a secret, naming rule, file and line', (t) => {
  const scanner = makeFakeScanner(t, { exitCode: 3, stdout: REPORT, stderr: '' });

  const hookRun = runPreCommit(t, withScanner(getGitEnv(process.env), scanner));

  assert.deepEqual([hookRun.status, hookRun.stderr], [
    2,
    'yapus commit: secret found: rule aws-access-token, a.env line 4\n'
    + 'yapus commit: stop and tell the person; if it was pushed, rotate it;'
    + ' do not rewrite history to hide it\n',
  ]);
});

test('refuses a commit when the scanner fails', (t) => {
  const failure: FakeAnswer = { exitCode: 1, stdout: '', stderr: 'bad flag\n' };
  const scanner = makeFakeScanner(t, failure);

  const hookRun = runPreCommit(t, withScanner(getGitEnv(process.env), scanner));

  assert.deepEqual([hookRun.status, hookRun.stderr], [
    2,
    'yapus commit: cannot scan the staged change (exit 1: bad flag); retry it\n',
  ]);
});

test('warns in one line and lets the commit through when the scanner is missing', (t) => {
  const env = { ...getGitEnv(process.env), PATH: makeToolDir(t, ['bash', 'dirname', 'node']) };

  const hookRun = runPreCommit(t, env);

  assert.deepEqual([hookRun.status, hookRun.stderr], [
    0,
    'yapus commit: gitleaks is not installed; the staged change is not scanned\n',
  ]);
});

test('is executable, since git skips a hook that is not', () => {
  assert.notEqual(statSync(PRE_COMMIT).mode & EXECUTE_BITS, 0);
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [PRE_COMMIT], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});

// The hook run as git runs it: from the repository root, with no arguments.
function runPreCommit(t: TestContext, env: NodeJS.ProcessEnv) {
  return spawnSync(BASH, [PRE_COMMIT], {
    cwd: makeTempRepo(t),
    encoding: 'utf8',
    env: { ...env, HOME: makeTempDir(t), TMPDIR: makeTempDir(t) },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
