import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSizeBranch } from './make-size-branch.ts';
import { runGit } from '../run-git.ts';

test('makes a branch of origin main that changes seven files', (t) => {
  const repo = makeSizeBranch(t);

  assert.equal(runGit(['branch', '--show-current'], repo), 'feat/size\n');
  assert.equal(
    runGit(['diff', '--name-only', 'origin/main...HEAD'], repo).split('\n').length,
    8,
  );
});
