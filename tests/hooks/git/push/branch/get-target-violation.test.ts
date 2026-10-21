import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTargetViolation } from '../../../../../hooks/git/push/branch/get-target-violation.ts';
import { runGit } from '../../../../helpers/run-git.ts';
import { makePushRepo, runAgentPush, runPersonPush } from './make-push-repo.ts';
import { setRemoteHead } from './set-remote-head.ts';

const ZERO_SHA = '0000000000000000000000000000000000000000';
const SHA = '1111111111111111111111111111111111111111';
const MAIN_REFUSAL =
  'yapus push: an agent may not push to refs/heads/main; push a branch and open a pull request\n';

test('refuses an agent push to main without the key', (t) => {
  const { repository } = makePushRepo(t);

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_REFUSAL));
});

test('lets an agent push to main when the key is true', (t) => {
  const { repository } = makePushRepo(t);

  runGit(['config', 'yapus.allowDefaultBranchPush', 'true'], repository);

  assert.equal(runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/main']).status, 0);
});

test('refuses an agent push to main when the key is false', (t) => {
  const { repository } = makePushRepo(t);

  runGit(['config', 'yapus.allowDefaultBranchPush', 'false'], repository);

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_REFUSAL));
});

test('lets a person push to main', (t) => {
  const { repository } = makePushRepo(t);

  assert.equal(runPersonPush(t, repository, ['origin', 'HEAD:refs/heads/main']).status, 0);
});

test('refuses an agent push to master', (t) => {
  const { repository } = makePushRepo(t);

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/master']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes('an agent may not push to refs/heads/master;'));
});

test('refuses an agent push to Main in another case', (t) => {
  const { repository } = makePushRepo(t);

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/Main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes('an agent may not push to refs/heads/Main;'));
});

test('lets an agent push another branch', (t) => {
  const { repository } = makePushRepo(t);

  assert.equal(runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/feat/x']).status, 0);
});

test('refuses an agent push to the branch the remote HEAD names', (t) => {
  const { repository } = makePushRepo(t);

  setRemoteHead(repository, 'origin', 'trunk');

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/trunk']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes('an agent may not push to refs/heads/trunk;'));
});

test('still refuses an agent push to main when the remote HEAD names trunk', (t) => {
  const { repository } = makePushRepo(t);

  setRemoteHead(repository, 'origin', 'trunk');

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_REFUSAL));
});

test('lets an agent push another branch when the remote HEAD names trunk', (t) => {
  const { repository } = makePushRepo(t);

  setRemoteHead(repository, 'origin', 'trunk');

  assert.equal(runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/feat/x']).status, 0);
});

test('refuses an agent push to init.defaultBranch', (t) => {
  const { repository } = makePushRepo(t);

  runGit(['config', 'init.defaultBranch', 'dev'], repository);

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/dev']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes('an agent may not push to refs/heads/dev;'));
});

test('does not count a deletion as a push to the branch', () => {
  const deletion = {
    localRef: '(delete)', localSha: ZERO_SHA, remoteRef: 'refs/heads/main', remoteSha: SHA,
  };
  const facts = {
    isAgent: true,
    getDefaultBranches: () => ['refs/heads/main'],
    getPushAllowance: () => false,
  };

  assert.equal(getTargetViolation(deletion, facts), undefined);
});

test('judges a push to a URL against the remote HEAD of origin', (t) => {
  const { repository, remote } = makePushRepo(t);

  setRemoteHead(repository, 'origin', 'trunk');

  const pushRun = runAgentPush(t, repository, [remote, 'HEAD:refs/heads/trunk']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes('an agent may not push to refs/heads/trunk;'));
});
