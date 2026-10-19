import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getReflogBase,
} from '../../../../../../hooks/claude/tyler/ashlar/state/get-reflog-base.ts';
import { recordStart } from '../../../../../../hooks/claude/tyler/ashlar/state/record-start.ts';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import {
  commitAt,
  LATER_TIME,
  makeDatedRepo,
  runGitAt,
  SECOND_TIME,
  START_TIME,
} from './make-dated-repo.ts';

function getPlace(repo: string): { cwd: string; env: NodeJS.ProcessEnv } {
  return { cwd: repo, env: getGitEnv(process.env) };
}

test('takes the commit the branch held at the start, not a later one', (t) => {
  const { repo, first } = makeDatedRepo(t);
  const dataDir = makeTempDir(t);

  recordStart(dataDir, 's1', START_TIME);
  commitAt(repo, 'b.txt', SECOND_TIME);

  assert.equal(getReflogBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }), first);
});

test('takes the earlier commit when update-ref moved the branch', (t) => {
  const { repo, first } = makeDatedRepo(t);
  const dataDir = makeTempDir(t);
  const branch = runGit(['symbolic-ref', '--short', 'HEAD'], repo).trim();
  const tree = runGit(['rev-parse', 'HEAD^{tree}'], repo).trim();
  const treeArgs = ['commit-tree', tree, '-p', first, '-m', 'test(fixture): add file'];
  const second = runGitAt(treeArgs, repo, SECOND_TIME).trim();

  recordStart(dataDir, 's1', START_TIME);
  runGitAt(['update-ref', `refs/heads/${ branch }`, second], repo, SECOND_TIME);

  assert.equal(getReflogBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }), first);
});

test('takes the earlier commit when a detached worktree made the later one', (t) => {
  const { repo, first } = makeDatedRepo(t);
  const dataDir = makeTempDir(t);
  const branch = runGit(['symbolic-ref', '--short', 'HEAD'], repo).trim();
  const worktree = join(makeTempDir(t), 'probe');

  runGit(['worktree', 'add', '--quiet', '--detach', worktree], repo);
  const second = commitAt(worktree, 'b.txt', SECOND_TIME);

  recordStart(dataDir, 's1', START_TIME);
  runGitAt(['update-ref', `refs/heads/${ branch }`, second, first], repo, LATER_TIME);

  assert.equal(getReflogBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }), first);
});

test('gives no answer when the session has no start file', (t) => {
  const { repo } = makeDatedRepo(t);
  const dataDir = makeTempDir(t);

  assert.equal(
    getReflogBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }),
    undefined,
  );
});
