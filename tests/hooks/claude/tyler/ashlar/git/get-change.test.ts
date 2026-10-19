import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  type Change,
  getChange,
  type Range,
} from '../../../../../../hooks/claude/tyler/ashlar/git/get-change.ts';
import { isFailure, type Place } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

test('gives no files and no lines for an identical base and tree', (t) => {
  const repo = makeCommittedRepo(t);
  const head = runGit(['rev-parse', 'HEAD'], repo).trim();

  assert.deepEqual(getChange(placeOf(repo), { base: head, tree: head }), { files: [], lines: 0 });
});

test('counts a modified line as one added and one removed', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, 'a.txt'), 'b\n');

  assert.deepEqual(changeOf(repo), {
    files: ['a.txt'],
    lines: 2,
  });
});

test('counts the lines of an added file', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, 'b.txt'), '1\n2\n3\n');

  assert.deepEqual(changeOf(repo), {
    files: ['b.txt'],
    lines: 3,
  });
});

test('counts the lines of a deleted file', (t) => {
  const repo = makeCommittedRepo(t);

  runGit(['rm', '--quiet', 'a.txt'], repo);

  assert.deepEqual(changeOf(repo), {
    files: ['a.txt'],
    lines: 1,
  });
});

test('lists a binary file with no lines', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255]));

  assert.deepEqual(changeOf(repo), {
    files: ['blob.bin'],
    lines: 0,
  });
});

test('gives a path with a space exactly', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, 'two words.txt'), 'x\n');

  assert.deepEqual(changeOf(repo).files, ['two words.txt']);
});

test('gives a path with a newline exactly', (t) => {
  const repo = makeCommittedRepo(t);

  writeFileSync(join(repo, 'two\nlines.txt'), 'x\n');

  assert.deepEqual(changeOf(repo).files, ['two\nlines.txt']);
});

test('gives a failure naming the git command for a bad id', (t) => {
  const repo = makeCommittedRepo(t);
  const change = getChange(placeOf(repo), { base: 'nowhere', tree: 'HEAD' });

  assert.ok(isFailure(change));
  assert.match(change.reason, /^git diff --numstat -z --no-renames nowhere HEAD: /);
});

function changeOf(repo: string): Change {
  const change = getChange(placeOf(repo), rangeToWorkingTree(repo));

  assert.ok(!isFailure(change), JSON.stringify(change));

  return change;
}

function placeOf(cwd: string): Place {
  return { cwd, env: getGitEnv(process.env) };
}

function rangeToWorkingTree(repo: string): Range {
  const env = { ...getGitEnv(process.env), GIT_INDEX_FILE: join(repo, '.git', 'temporary-index') };
  const place: Place = { cwd: repo, env };

  runGitIn(['add', '-A'], place);

  return { base: 'HEAD', tree: runGitIn(['write-tree'], place).trim() };
}

function runGitIn(args: readonly string[], place: Place): string {
  return execFileSync('git', args, { cwd: place.cwd, encoding: 'utf8', env: place.env });
}
