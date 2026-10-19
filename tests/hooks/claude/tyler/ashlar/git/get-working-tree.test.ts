import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getWorkingTree,
} from '../../../../../../hooks/claude/tyler/ashlar/git/get-working-tree.ts';
import { isFailure } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { runGit } from '../../../../../helpers/run-git.ts';

test('changes the tree for a modified tracked file', (t) => {
  const repo = makeCommittedRepo(t);
  const before = takeTree(repo, repo);

  writeFileSync(join(repo, 'a.txt'), 'changed\n');

  assert.notEqual(takeTree(repo, repo), before);
});

test('leaves the real index byte-identical', (t) => {
  const repo = makeCommittedRepo(t);
  const indexPath = join(repo, '.git', 'index');
  const before = readFileSync(indexPath);

  writeFileSync(join(repo, 'a.txt'), 'changed\n');
  writeFileSync(join(repo, 'new.txt'), 'new\n');
  takeTree(repo, repo);

  assert.deepEqual(readFileSync(indexPath), before);
});

test('includes an untracked file in the tree', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, 'new.txt'), 'new\n');

  assert.equal(listTree(repo, repo), 'a.txt\nnew.txt\n');
});

test('excludes a file matched by .gitignore from the tree', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, '.gitignore'), 'skip.txt\n');
  writeFileSync(join(repo, 'skip.txt'), 'skip\n');

  assert.equal(listTree(repo, repo), '.gitignore\na.txt\n');
});

test('covers files outside the subdirectory of the cwd', (t) => {
  const repo = makeCommittedRepo(t);
  const subdir = join(repo, 'sub');

  mkdirSync(subdir);

  assert.equal(listTree(subdir, repo), 'a.txt\n');
});

function listTree(cwd: string, repo: string): string {
  return runGit(['ls-tree', '-r', '--name-only', takeTree(cwd, repo)], repo);
}

function takeTree(cwd: string, repo: string): string {
  const tree = getWorkingTree(repo, { cwd, env: process.env, deadline: Number.POSITIVE_INFINITY });

  assert.ok(!isFailure(tree), JSON.stringify(tree));

  return tree;
}
