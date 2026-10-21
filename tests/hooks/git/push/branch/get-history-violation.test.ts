import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getHistoryViolation,
} from '../../../../../hooks/git/push/branch/get-history-violation.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../../helpers/run-git.ts';
import { makePushRepo, runAgentPush, runPersonPush, seedRemote } from './make-push-repo.ts';

const MAIN_REWRITE = 'yapus push: rewrites refs/heads/main; a person does it on the server\n';
const MAIN_DELETION = 'yapus push: deletes refs/heads/main; a person does it on the server\n';
// The test repository runs the commit-msg hook too, so a subject keeps its rule.
const REWRITTEN = 'feat(hooks): add a rewrite';
const KEY = 'yapus.allowDefaultBranchPush';
const MISSING_RECORD = {
  localRef: 'refs/heads/main',
  localSha: '3333333333333333333333333333333333333333',
  remoteRef: 'refs/heads/main',
  remoteSha: '2222222222222222222222222222222222222222',
};

test('refuses a person forcing main', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/main');
  runGit(['commit', '--amend', '--allow-empty', '--message', REWRITTEN], repository);

  const pushRun = runPersonPush(t, repository, ['origin', '+HEAD:refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_REWRITE));
});

test('refuses a force to main dressed as a fast-forward by a replace graft', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/main');
  const remoteSha = runGit(['rev-parse', 'HEAD'], repository).trim();

  runGit(['commit', '--amend', '--allow-empty', '--message', REWRITTEN], repository);
  runGit(['replace', '--graft', 'HEAD', remoteSha], repository);

  const pushRun = runPersonPush(t, repository, ['origin', '+HEAD:refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_REWRITE));
});

test('refuses an agent forcing main even when the key is true', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/main');
  runGit(['config', KEY, 'true'], repository);
  runGit(['commit', '--amend', '--allow-empty', '--message', REWRITTEN], repository);

  const pushRun = runAgentPush(t, repository, ['origin', '+HEAD:refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_REWRITE));
});

test('refuses a person deleting main', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/main');

  const pushRun = runPersonPush(t, repository, ['origin', ':refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_DELETION));
});

test('refuses an agent deleting main even when the key is true', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/main');
  runGit(['config', KEY, 'true'], repository);

  const pushRun = runAgentPush(t, repository, ['origin', ':refs/heads/main']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(MAIN_DELETION));
});

test('refuses an agent deleting another branch', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/feat/x');

  const pushRun = runAgentPush(t, repository, ['origin', ':refs/heads/feat/x']);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes('an agent may not delete refs/heads/feat/x;'));
});

test('lets a person delete another branch', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/feat/x');

  assert.equal(runPersonPush(t, repository, ['origin', ':refs/heads/feat/x']).status, 0);
});

test('lets an agent fast-forward another branch', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/feat/x');
  runGit(['commit', '--allow-empty', '--message', 'feat(hooks): add a step'], repository);

  assert.equal(runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/feat/x']).status, 0);
});

test('lets an agent force another branch', (t) => {
  const { repository } = makePushRepo(t);

  seedRemote(repository, 'refs/heads/feat/x');
  runGit(['commit', '--amend', '--allow-empty', '--message', REWRITTEN], repository);

  assert.equal(runAgentPush(t, repository, ['origin', '+HEAD:refs/heads/feat/x']).status, 0);
});

test('counts a remote sha the repository does not have as a force', (t) => {
  const repository = makeTempRepo(t);

  assert.equal(
    getHistoryViolation(MISSING_RECORD, factsOf(repository, Number.POSITIVE_INFINITY)),
    'rewrites refs/heads/main; a person does it on the server',
  );
});

test('refuses when the time budget is spent before the comparison', (t) => {
  const repository = makeTempRepo(t);

  assert.match(
    getHistoryViolation(MISSING_RECORD, factsOf(repository, 0)) ?? '',
    /^cannot compare refs\/heads\/main with the push \(git --no-replace-objects merge-base --is-ancestor \w+ \w+: ran out of its time budget\); the push is blocked, retry it$/,
  );
});

test('refuses a deletion of Main in another case', () => {
  const deletion = { ...MISSING_RECORD, localSha: '0'.repeat(40), remoteRef: 'refs/heads/Main' };

  assert.equal(
    getHistoryViolation(deletion, factsOf('/', Number.POSITIVE_INFINITY)),
    'deletes refs/heads/Main; a person does it on the server',
  );
});

function factsOf(repository: string, deadline: number) {
  return {
    isAgent: false,
    place: { cwd: repository, env: getGitEnv(process.env), deadline },
    getDefaultBranches: () => ['refs/heads/main'],
    getPushAllowance: () => false,
  };
}
