import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { type TestContext, test } from 'node:test';
import { getPushViolation } from '../../../../hooks/git/push/get-push-violation.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { FAILING_TEST, makeNpmRepo, PASSING_TEST } from './make-npm-repo.ts';

const REMOTE_SHA = '1111111111111111111111111111111111111111';
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
    'the push test was interrupted',
  );
});

function makePushLine(sha: string): string {
  return `refs/heads/main ${ sha } refs/heads/main ${ REMOTE_SHA }\n`;
}

// The hook's own TMPDIR is its temporary parent; npm keeps a compile cache in
// TMPDIR, which the tests check is left empty, so the cache is off.
function makePushInput(t: TestContext, repository: string, stdinText: string) {
  const tempParent = makeTempDir(t);

  return {
    stdinText,
    env: {
      ...getGitEnv(process.env),
      HOME: makeTempDir(t),
      TMPDIR: tempParent,
      NODE_DISABLE_COMPILE_CACHE: '1',
      npm_config_update_notifier: 'false',
    },
    repository,
    tempParent,
    signal: new AbortController().signal,
  };
}
