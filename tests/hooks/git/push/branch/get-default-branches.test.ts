import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { getDefaultBranches } from '../../../../../hooks/git/push/branch/get-default-branches.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../../helpers/run-git.ts';
import { setRemoteHead } from './set-remote-head.ts';

test('names main and master when nothing else is set', (t) => {
  const repository = makeRepository(t);

  assert.deepEqual(getDefaultBranches(queryOf(repository)), [
    'refs/heads/main',
    'refs/heads/master',
  ]);
});

test('adds init.defaultBranch and the branch the remote HEAD names', (t) => {
  const repository = makeRepository(t);

  runGit(['config', 'init.defaultBranch', 'dev'], repository);
  setRemoteHead(repository, 'origin', 'trunk');

  assert.deepEqual(getDefaultBranches(queryOf(repository)), [
    'refs/heads/main',
    'refs/heads/master',
    'refs/heads/dev',
    'refs/heads/trunk',
  ]);
});

test('adds the branch every remote HEAD names', (t) => {
  const repository = makeRepository(t);

  setRemoteHead(repository, 'origin', 'trunk');
  setRemoteHead(repository, 'fork', 'next');

  assert.deepEqual(getDefaultBranches(queryOf(repository)), [
    'refs/heads/main',
    'refs/heads/master',
    'refs/heads/next',
    'refs/heads/trunk',
  ]);
});

test('refuses a remote HEAD that points outside its remote', (t) => {
  const repository = makeRepository(t);

  runGit(['branch', 'elsewhere'], repository);
  runGit(['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/heads/elsewhere'], repository);

  assert.deepEqual(getDefaultBranches(queryOf(repository)), {
    violation:
      'cannot read the default branch (refs/remotes/origin/HEAD points to refs/heads/elsewhere); the push is blocked, retry it',
  });
});

test('refuses when the time budget is spent', (t) => {
  const repository = makeRepository(t);

  assert.deepEqual(getDefaultBranches({ ...queryOf(repository), deadline: 0 }), {
    violation:
      'cannot read the default branch (git config --get init.defaultBranch: ran out of its time budget); the push is blocked, retry it',
  });
});

// git lists a remote HEAD only when its target exists, which needs a commit.
function makeRepository(t: TestContext): string {
  const repository = makeTempRepo(t);

  runGit(['commit', '--allow-empty', '--quiet', '--message', 'first'], repository);

  return repository;
}

function queryOf(repository: string) {
  return { repository, env: getGitEnv(process.env), deadline: Number.POSITIVE_INFINITY };
}
