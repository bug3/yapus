import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { getPushViolation } from '../../../../hooks/git/push/get-push-violation.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { FAILING_TEST, makeNpmRepo, PASSING_TEST } from './make-npm-repo.ts';

const REMOTE_SHA = '1111111111111111111111111111111111111111';

test('passes a push whose commit passes npm test', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);

  assert.equal(getPushViolation(makePushInput(t, repository, makePushLine(sha))), undefined);
});

test('refuses a push whose commit fails npm test', (t) => {
  const { repository, sha } = makeNpmRepo(t, FAILING_TEST);

  assert.equal(
    getPushViolation(makePushInput(t, repository, makePushLine(sha))),
    `npm test failed on ${ sha.slice(0, 12) }; fix it, then push again`,
  );
});

test('refuses a malformed push line', (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);

  assert.equal(
    getPushViolation(makePushInput(t, repository, 'refs/heads/main\n')),
    'push line 1 is not "<local ref> <local sha> <remote ref> <remote sha>"; the push is blocked, retry it',
  );
});

test('refuses a push when git is missing', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);
  const pushInput = makePushInput(t, repository, makePushLine(sha));

  assert.equal(
    getPushViolation({ ...pushInput, env: { PATH: makeTempDir(t) } }),
    'git not found; install git 2.17 or newer',
  );
});

function makePushLine(sha: string): string {
  return `refs/heads/main ${ sha } refs/heads/main ${ REMOTE_SHA }\n`;
}

function makePushInput(t: TestContext, repository: string, stdinText: string) {
  return {
    stdinText,
    env: { ...getGitEnv(process.env), HOME: makeTempDir(t), npm_config_update_notifier: 'false' },
    repository,
    tempParent: makeTempDir(t),
  };
}
