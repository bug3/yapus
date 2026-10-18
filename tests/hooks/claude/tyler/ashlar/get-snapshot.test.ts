import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getSnapshot,
  type Snapshot,
} from '../../../../../hooks/claude/tyler/ashlar/get-snapshot.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from './make-committed-repo.ts';
import { runGit } from '../../../../helpers/run-git.ts';

test('gives none for a directory outside any repository', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(getSnapshot(dir, process.env), { kind: 'none' });
});

test('takes the commit tree as tree in a clean repository', (t) => {
  const repo = makeCommittedRepo(t);

  assert.equal(
    takeSnapshot(repo, process.env).tree,
    runGit(['rev-parse', 'HEAD^{tree}'], repo).trim(),
  );
});

test('gives a failure, not none, for a fatal git error that is not a missing repository', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, '.git', 'config'), '[core\n');

  assert.deepEqual(getSnapshot(repo, process.env), {
    kind: 'failure',
    reason: 'git rev-parse --is-inside-work-tree: fatal: bad config line 1 in file .git/config',
  });
});

test('gives the toplevel as root for a subdirectory', (t) => {
  const repo = makeCommittedRepo(t);
  const subdir = join(repo, 'sub');

  mkdirSync(subdir);

  assert.equal(realpathSync(takeSnapshot(subdir, process.env).root), realpathSync(repo));
});

test('ignores a GIT_DIR that points nowhere', (t) => {
  const repo = makeCommittedRepo(t);
  const env = { ...process.env, GIT_DIR: join(repo, 'nowhere') };

  assert.equal(
    takeSnapshot(repo, env).tree,
    runGit(['rev-parse', 'HEAD^{tree}'], repo).trim(),
  );
});

function takeSnapshot(cwd: string, env: NodeJS.ProcessEnv): Snapshot {
  const result = getSnapshot(cwd, env);

  assert.ok(result.kind === 'snapshot', JSON.stringify(result));

  return result.snapshot;
}
