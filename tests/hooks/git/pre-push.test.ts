import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../helpers/run-git.ts';
import { CLEAN_ANSWER, makeFakeScanner } from '../../helpers/scanner/make-fake-scanner.ts';
import { makeToolDir } from '../../helpers/scanner/make-tool-dir.ts';
import { withScanner } from '../../helpers/scanner/with-scanner.ts';
import { listWorktrees } from './push/list-worktrees.ts';
import { FAILING_TEST, makeNpmRepo, PASSING_TEST } from './push/make-npm-repo.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const PRE_PUSH = join(ROOT, 'hooks', 'git', 'pre-push');
const SUBPROCESS_TIMEOUT_MS = 60000;
const BASH = execFileSync('/bin/sh', ['-c', 'command -v bash'], {
  encoding: 'utf8',
  timeout: SUBPROCESS_TIMEOUT_MS,
}).trim();
const EXECUTE_BITS = 0o111;
const NEW_REF_SHA = '0000000000000000000000000000000000000000';

test('lets a push through when npm test passes on its commit', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);

  const pushRun = runPrePush(t, repository, makePushLine(sha));

  assert.deepEqual(
    [pushRun.status, pushRun.stdout, listWorktrees(repository), pushRun.tempEntries],
    [0, '', [realpathSync(repository)], []],
  );
});

test('refuses a push when npm test fails on its commit', (t) => {
  const { repository, sha } = makeNpmRepo(t, FAILING_TEST);

  const pushRun = runPrePush(t, repository, makePushLine(sha));

  assert.deepEqual(
    [
      pushRun.status,
      pushRun.stderr.split('\n').at(-2),
      listWorktrees(repository),
      pushRun.tempEntries,
    ],
    [
      2,
      `yapus push: npm test failed on ${ sha.slice(0, 12) }; fix it, then push again`,
      [realpathSync(repository)],
      [],
    ],
  );
});

test('warns in one line and goes on to npm test when the scanner is missing', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);
  const tools = makeToolDir(t, ['basename', 'bash', 'dirname', 'env', 'git', 'node', 'npm', 'sh']);

  const pushRun = runPrePushWithPath(t, {
    repository, stdinText: makePushLine(sha), pathText: tools,
  });

  assert.deepEqual([pushRun.status, pushRun.stderr.split('\n')[0]], [
    0,
    'yapus push: gitleaks is not installed; the outgoing change is not scanned',
  ]);
});

test('is executable, since git skips a hook that is not', () => {
  assert.notEqual(statSync(PRE_PUSH).mode & EXECUTE_BITS, 0);
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [PRE_PUSH], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});

function makePushLine(sha: string): string {
  return `refs/heads/main ${ sha } refs/heads/test/push ${ NEW_REF_SHA }\n`;
}

// The hook run as git runs it: from the repository root, with the remote name
// and URL as arguments and the push lines on stdin, and what it left in its
// own TMPDIR. npm keeps a compile cache in TMPDIR, so the cache is off. PATH
// starts with a clean fake scanner unless the test gives its own PATH.
function runPrePush(t: TestContext, repository: string, stdinText: string) {
  return runPrePushWithPath(t, { repository, stdinText });
}

interface PrePushRun {
  readonly repository: string;
  readonly stdinText: string;
  readonly pathText?: string;
}

function runPrePushWithPath(t: TestContext, { repository, stdinText, pathText }: PrePushRun) {
  const tempParent = makeTempDir(t);
  const gitEnv = withScanner(getGitEnv(process.env), makeFakeScanner(t, CLEAN_ANSWER));
  const pushRun = spawnSync(BASH, [PRE_PUSH, 'origin', 'https://example.invalid/repo.git'], {
    cwd: repository,
    encoding: 'utf8',
    env: {
      ...gitEnv,
      PATH: pathText ?? gitEnv.PATH,
      HOME: makeTempDir(t),
      TMPDIR: tempParent,
      NODE_DISABLE_COMPILE_CACHE: '1',
      npm_config_update_notifier: 'false',
    },
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { ...pushRun, tempEntries: readdirSync(tempParent) };
}
