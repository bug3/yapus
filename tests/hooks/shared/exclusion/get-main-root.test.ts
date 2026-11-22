import assert from 'node:assert/strict';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { getMainRoot } from '../../../../hooks/shared/exclusion/get-main-root.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';

const GIT_ENV = getGitEnv(process.env);

test('gives the real path of the root from the main checkout', (t) => {
  const repo = makeTempRepo(t);

  assert.equal(getMainRoot(repo, GIT_ENV), realpathSync(repo));
});

test('gives the main checkout root from a linked worktree', (t) => {
  const repo = makeTempRepo(t);

  assert.equal(getMainRoot(makeLinkedWorktree(t, repo), GIT_ENV), realpathSync(repo));
});

test('gives the root from a subdirectory', (t) => {
  const repo = makeTempRepo(t);
  const subdirectory = join(repo, 'sub');

  mkdirSync(subdirectory);

  assert.equal(getMainRoot(subdirectory, GIT_ENV), realpathSync(repo));
});

test('gives the directory itself outside git', (t) => {
  const directory = makeTempDir(t);

  assert.equal(getMainRoot(directory, GIT_ENV), realpathSync(directory));
});

test('gives a bare repository itself, whose git directory is not named .git', (t) => {
  const bare = makeTempDir(t);

  runGit(['init', '--quiet', '--bare'], bare);

  assert.equal(getMainRoot(bare, GIT_ENV), realpathSync(bare));
});

function makeLinkedWorktree(t: TestContext, repo: string): string {
  const worktree = join(makeTempDir(t), 'worktree');

  runGit(['commit', '--quiet', '--allow-empty', '-m', 'start'], repo);
  runGit(['worktree', 'add', '--quiet', '-b', 'linked', worktree], repo);

  return worktree;
}
