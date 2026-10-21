import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { type TestContext, test } from 'node:test';
import { getPushViolation } from '../../../../hooks/git/push/get-push-violation.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { CLEAN_ANSWER, makeFakeScanner } from '../../../helpers/scanner/make-fake-scanner.ts';
import { withScanner } from '../../../helpers/scanner/with-scanner.ts';
import { FAILING_TEST, makeNpmRepo, PASSING_TEST } from './make-npm-repo.ts';

const NEW_REF_SHA = '0000000000000000000000000000000000000000';
const DELETION_LINE =
  '(delete) 0000000000000000000000000000000000000000 refs/heads/old 1111111111111111111111111111111111111111\n';

test('passes a push whose commit passes npm test', async (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);
  const pushInput = makePushInput(t, repository, makePushLine(sha));

  assert.deepEqual(
    [await getPushViolation(pushInput), readdirSync(pushInput.tempParent)],
    [undefined, []],
  );
});

test('refuses a push whose commit fails npm test', async (t) => {
  const { repository, sha } = makeNpmRepo(t, FAILING_TEST);
  const pushInput = makePushInput(t, repository, makePushLine(sha));

  assert.deepEqual(
    [await getPushViolation(pushInput), readdirSync(pushInput.tempParent)],
    [`npm test failed on ${ sha.slice(0, 12) }; fix it, then push again`, []],
  );
});

test('refuses a push whose commits hold a secret before npm test runs', async (t) => {
  const { repository, sha } = makeNpmRepo(t, FAILING_TEST);
  const pushInput = makePushInput(t, repository, makePushLine(sha));
  const report = '[{"RuleID":"aws-access-token","File":"a.env","StartLine":4}]';
  const scanner = makeFakeScanner(t, { exitCode: 3, stdout: report, stderr: '' });

  assert.equal(
    await getPushViolation({ ...pushInput, env: withScanner(pushInput.env, scanner) }),
    'secret found: rule aws-access-token, a.env line 4; stop and tell the person;'
    + ' if it was pushed, rotate it; do not rewrite history to hide it',
  );
});

test('refuses a malformed push line', async (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);

  assert.equal(
    await getPushViolation(makePushInput(t, repository, 'refs/heads/main\n')),
    'push line 1 is not "<local ref> <local sha> <remote ref> <remote sha>"; the push is blocked, retry it',
  );
});

test('refuses a push when git is missing', async (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);
  const pushInput = makePushInput(t, repository, makePushLine(sha));

  assert.equal(
    await getPushViolation({ ...pushInput, env: { PATH: makeTempDir(t) } }),
    'git not found; install git 2.17 or newer',
  );
});

test('refuses a push that only deletes when a signal came', async (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);
  const pushInput = makePushInput(t, repository, DELETION_LINE);

  assert.equal(
    await getPushViolation({ ...pushInput, signal: AbortSignal.abort() }),
    'the push test was interrupted; push again to test it',
  );
});

function makePushLine(sha: string): string {
  return `refs/heads/main ${ sha } refs/heads/test/push ${ NEW_REF_SHA }\n`;
}

// The hook's own TMPDIR is its temporary parent; npm keeps a compile cache in
// TMPDIR, which the tests check is left empty, so the cache is off.
function makePushInput(t: TestContext, repository: string, stdinText: string) {
  const tempParent = makeTempDir(t);

  // A clean fake scanner is first on PATH, so that the scan says nothing.
  return {
    stdinText,
    env: withScanner({
      ...getGitEnv(process.env),
      HOME: makeTempDir(t),
      TMPDIR: tempParent,
      NODE_DISABLE_COMPILE_CACHE: '1',
      npm_config_update_notifier: 'false',
    }, makeFakeScanner(t, CLEAN_ANSWER)),
    repository,
    tempParent,
    signal: new AbortController().signal,
    remote: 'origin',
    warn: () => undefined,
  };
}
