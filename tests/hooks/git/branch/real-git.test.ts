import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { runGit } from '../../../helpers/run-git.ts';
import {
  hasRef, makeBranchRepo, makeUnbornRepo, runAgentGit, runPersonGit,
} from './make-branch-repo.ts';

const BAD_NAME_REFUSAL = /^yapus branch: branch `Bad_Name` is not `<type>\/<slug>` \(type from \S+types\.json, slug of lowercase letters, digits and hyphens, at most 50\); name it so$/m;
const BAD_REFUSAL = /^yapus branch: branch `bad` is not `<type>\/<slug>` /m;

test('refuses an agent git checkout -b of a branch not named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);

  const checkoutRun = runAgentGit(t, repository, ['checkout', '-b', 'Bad_Name']);

  assert.notEqual(checkoutRun.status, 0);
  assert.match(checkoutRun.stderr, BAD_NAME_REFUSAL);
  assert.equal(hasRef(repository, 'refs/heads/Bad_Name'), false);
});

test('refuses an agent git switch -c of a branch not named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);

  const switchRun = runAgentGit(t, repository, ['switch', '-c', 'bad']);

  assert.notEqual(switchRun.status, 0);
  assert.match(switchRun.stderr, BAD_REFUSAL);
  assert.equal(hasRef(repository, 'refs/heads/bad'), false);
});

test('refuses an agent git branch of a branch not named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);

  const branchRun = runAgentGit(t, repository, ['branch', 'bad']);

  assert.notEqual(branchRun.status, 0);
  assert.match(branchRun.stderr, BAD_REFUSAL);
  assert.equal(hasRef(repository, 'refs/heads/bad'), false);
});

test('refuses an agent git worktree add -b of a branch not named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);
  const worktree = join(makeTempDir(t), 'worktree');

  const worktreeRun = runAgentGit(t, repository, ['worktree', 'add', '-b', 'bad', worktree]);

  assert.notEqual(worktreeRun.status, 0);
  assert.match(worktreeRun.stderr, BAD_REFUSAL);
  assert.equal(hasRef(repository, 'refs/heads/bad'), false);
});

test('lets an agent git checkout -b a branch named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);

  const checkoutRun = runAgentGit(t, repository, ['checkout', '--quiet', '-b', 'feat/ok']);

  assert.deepEqual([checkoutRun.status, checkoutRun.stderr], [0, '']);
  assert.equal(hasRef(repository, 'refs/heads/feat/ok'), true);
});

test('lets an agent make the first commit on main', (t) => {
  const repository = makeUnbornRepo(t);

  const commitRun = runAgentGit(
    t, repository, ['commit', '--quiet', '--allow-empty', '-m', 'feat(hooks): add a check'],
  );

  assert.equal(commitRun.status, 0);
  assert.equal(hasRef(repository, 'refs/heads/main'), true);
});

test('lets an agent commit on an existing branch not named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);

  runGit(['checkout', '--quiet', '-b', 'Bad_Name'], repository);

  const commitRun = runAgentGit(
    t, repository, ['commit', '--quiet', '--allow-empty', '-m', 'feat(hooks): add a check'],
  );

  assert.equal(commitRun.status, 0);
});

test('lets an agent force an existing branch not named <type>/<slug>', (t) => {
  const repository = makeBranchRepo(t);

  runGit(['branch', 'bad'], repository);

  const forceRun = runAgentGit(t, repository, ['branch', '--force', 'bad', 'main']);

  assert.deepEqual([forceRun.status, forceRun.stderr], [0, '']);
});

test('lets an agent check out a branch a remote has under any name', (t) => {
  const repository = makeBranchRepo(t);

  runGit(['update-ref', 'refs/remotes/origin/Bad_Name', 'HEAD'], repository);

  const checkoutRun = runAgentGit(
    t, repository, ['checkout', '--quiet', '-b', 'Bad_Name', 'origin/Bad_Name'],
  );

  assert.equal(checkoutRun.status, 0);
  assert.equal(hasRef(repository, 'refs/heads/Bad_Name'), true);
});

test('lets a person git checkout -b a branch of any name', (t) => {
  const repository = makeBranchRepo(t);

  const checkoutRun = runPersonGit(t, repository, ['checkout', '--quiet', '-b', 'Bad_Name']);

  assert.deepEqual([checkoutRun.status, checkoutRun.stderr], [0, '']);
  assert.equal(hasRef(repository, 'refs/heads/Bad_Name'), true);
});
