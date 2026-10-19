import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Place } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { getBase } from '../../../../../../hooks/claude/tyler/ashlar/state/get-base.ts';
import { recordStart } from '../../../../../../hooks/claude/tyler/ashlar/state/record-start.ts';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';
import { commitAt, makeDatedRepo, SECOND_TIME, START_TIME } from './make-dated-repo.ts';

function getPlace(repo: string): Place {
  return { cwd: repo, env: getGitEnv(process.env), deadline: Number.POSITIVE_INFINITY };
}

test('names the reflog as the source when it answers', (t) => {
  const { repo, first } = makeDatedRepo(t);
  const dataDir = makeTempDir(t);

  recordStart(dataDir, 's1', START_TIME);
  commitAt(repo, 'b.txt', SECOND_TIME);

  assert.deepEqual(
    getBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }),
    { kind: 'base', id: first, source: 'reflog' },
  );
});

test('takes HEAD when the session has no start file', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  assert.deepEqual(
    getBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }),
    { kind: 'base', id: runGit(['rev-parse', 'HEAD'], repo).trim(), source: 'head' },
  );
});

test('takes the empty tree when HEAD is unborn', (t) => {
  const repo = makeTempRepo(t);
  const dataDir = makeTempDir(t);

  recordStart(dataDir, 's1', START_TIME);

  assert.deepEqual(
    getBase(getPlace(repo), { dataDir, sessionId: 's1', root: repo }),
    {
      kind: 'base',
      id: runGit(['hash-object', '-t', 'tree', '/dev/null'], repo).trim(),
      source: 'head',
    },
  );
});

test('returns the stored base after HEAD moved and the branch switched', (t) => {
  const { repo, first } = makeDatedRepo(t);
  const dataDir = makeTempDir(t);
  const key = { dataDir, sessionId: 's1', root: repo };

  recordStart(dataDir, 's1', START_TIME);
  getBase(getPlace(repo), key);
  runGit(['switch', '--quiet', '--create', 'other'], repo);
  commitAt(repo, 'b.txt', SECOND_TIME);

  assert.deepEqual(getBase(getPlace(repo), key), { kind: 'base', id: first, source: 'stored' });
});

test('keeps a separate base for each root of one session', (t) => {
  const { repo: repoOne } = makeDatedRepo(t);
  const repoTwo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  getBase(getPlace(repoOne), { dataDir, sessionId: 's1', root: repoOne });

  assert.deepEqual(
    getBase(getPlace(repoTwo), { dataDir, sessionId: 's1', root: repoTwo }),
    { kind: 'base', id: runGit(['rev-parse', 'HEAD'], repoTwo).trim(), source: 'head' },
  );
});
