import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getSnapshot,
  type Snapshot,
} from '../../../../../../hooks/claude/tyler/ashlar/git/get-snapshot.ts';
import type { Place } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';

test('gives none for a directory outside any repository', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(getSnapshot(placeOf(dir)), { kind: 'none' });
});

test('takes the commit tree as tree in a clean repository', (t) => {
  const repo = makeCommittedRepo(t);

  assert.equal(
    takeSnapshot(repo).tree,
    runGit(['rev-parse', 'HEAD^{tree}'], repo).trim(),
  );
});

test('gives a failure, not none, for a fatal git error that is not a missing repository', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, '.git', 'config'), '[core\n');

  assert.deepEqual(getSnapshot(placeOf(repo)), {
    kind: 'failure',
    reason: 'git rev-parse --is-inside-work-tree: fatal: bad config line 1 in file .git/config',
  });
});

test('gives the toplevel as root for a subdirectory', (t) => {
  const repo = makeCommittedRepo(t);
  const subdir = join(repo, 'sub');

  mkdirSync(subdir);

  assert.equal(realpathSync(takeSnapshot(subdir).root), realpathSync(repo));
});

function takeSnapshot(cwd: string): Snapshot {
  const result = getSnapshot(placeOf(cwd));

  assert.ok(result.kind === 'snapshot', JSON.stringify(result));

  return result.snapshot;
}

function placeOf(cwd: string): Place {
  return { cwd, env: getGitEnv(process.env) };
}
