import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runGit } from '../../../../helpers/run-git.ts';
import { makePushRepo, runAgentPush, runPersonPush } from './make-push-repo.ts';

const NAME_REFUSAL = /yapus push: branch `wip` is not `<type>\/<slug>` \(type from \S+types\.json, slug of lowercase letters, digits and hyphens, at most 50\); name it so\n/;

test('refuses an agent push to a branch not named <type>/<slug>', (t) => {
  const { repository } = makePushRepo(t);

  const pushRun = runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/wip']);

  assert.equal(pushRun.status, 1);
  assert.match(pushRun.stderr, NAME_REFUSAL);
});

test('lets an agent push a branch named <type>/<slug>', (t) => {
  const { repository } = makePushRepo(t);

  assert.equal(runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/fix/a-b']).status, 0);
});

test('lets an agent push to the default branch when the key allows it', (t) => {
  const { repository } = makePushRepo(t);

  runGit(['config', 'yapus.allowDefaultBranchPush', 'true'], repository);

  assert.equal(runAgentPush(t, repository, ['origin', 'HEAD:refs/heads/main']).status, 0);
});

test('lets an agent push a tag', (t) => {
  const { repository } = makePushRepo(t);

  runGit(['tag', 'v1'], repository);

  assert.equal(runAgentPush(t, repository, ['origin', 'refs/tags/v1']).status, 0);
});

test('lets a person push a branch of any name', (t) => {
  const { repository } = makePushRepo(t);

  assert.equal(runPersonPush(t, repository, ['origin', 'HEAD:refs/heads/wip']).status, 0);
});
