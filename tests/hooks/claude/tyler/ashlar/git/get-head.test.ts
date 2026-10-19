import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHead } from '../../../../../../hooks/claude/tyler/ashlar/git/get-head.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';
import { runGit } from '../../../../../helpers/run-git.ts';

test('takes the commit as head in a clean repository', (t) => {
  const repo = makeCommittedRepo(t);

  assert.equal(
    getHead({ cwd: repo, env: process.env }),
    runGit(['rev-parse', 'HEAD'], repo).trim(),
  );
});

test('takes the empty tree as head when HEAD is unborn', (t) => {
  const repo = makeTempRepo(t);

  assert.equal(
    getHead({ cwd: repo, env: process.env }),
    runGit(['hash-object', '-t', 'tree', '/dev/null'], repo).trim(),
  );
});
