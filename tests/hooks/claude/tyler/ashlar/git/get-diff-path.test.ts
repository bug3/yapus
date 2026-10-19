import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getDiffPath } from '../../../../../../hooks/claude/tyler/ashlar/git/get-diff-path.ts';
import { isFailure, type Place } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../../../helpers/run-git.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

test('puts the diff under the git dir', (t) => {
  const repo = makeCommittedRepo(t);

  assert.equal(
    getDiffPath(placeOf(repo), 'session-1'),
    join(repo, '.git', 'ashlar', 'session-1.diff'),
  );
});

test('gives the path under the root git dir from a subdirectory', (t) => {
  const repo = makeCommittedRepo(t);
  const subdir = join(repo, 'sub');

  mkdirSync(subdir);

  assert.equal(
    getDiffPath(placeOf(subdir), 'session-1'),
    join(repo, '.git', 'ashlar', 'session-1.diff'),
  );
});

test('gives a failure outside a repository', (t) => {
  assert.ok(isFailure(getDiffPath(placeOf(makeTempDir(t)), 'session-1')));
});

function placeOf(cwd: string): Place {
  return { cwd, env: getGitEnv(process.env), deadline: Number.POSITIVE_INFINITY };
}
