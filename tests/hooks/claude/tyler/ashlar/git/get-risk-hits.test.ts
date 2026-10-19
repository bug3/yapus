import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import type { Range } from '../../../../../../hooks/claude/tyler/ashlar/git/get-change.ts';
import {
  getRiskHits,
  type RiskHit,
} from '../../../../../../hooks/claude/tyler/ashlar/git/get-risk-hits.ts';
import { isFailure, type Place } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

const SECRET_HIT: readonly RiskHit[] = [{ file: 'secrets/key.txt', glob: 'secrets/**' }];

test('gives no hits when no ashlar-paths exists anywhere', (t) => {
  const repo = makeCommittedRepo(t);

  assert.deepEqual(hitsOf(repo, ['secrets/key.txt']), []);
});

test('matches a changed file against a glob at the tree', (t) => {
  const repo = makeCommittedRepo(t);

  writeFile(repo, '.claude/ashlar-paths', 'secrets/**\n');

  assert.deepEqual(hitsOf(repo, ['secrets/key.txt']), SECRET_HIT);
});

test('keeps a glob that exists only at the base', (t) => {
  const repo = makeCommittedRepo(t);

  writeFile(repo, '.claude/ashlar-paths', 'secrets/**\n');
  runGit(['add', '-A'], repo);
  runGit(['commit', '--quiet', '-m', 'test(fixture): add globs'], repo);
  runGit(['rm', '--quiet', '.claude/ashlar-paths'], repo);

  assert.deepEqual(hitsOf(repo, ['secrets/key.txt']), SECRET_HIT);
});

test('does not take a blank line for a glob', (t) => {
  const repo = makeCommittedRepo(t);

  // A blank glob would match only the empty path.
  writeFile(repo, '.claude/ashlar-paths', 'secrets/**\n  \ndb/**\n');

  assert.deepEqual(hitsOf(repo, ['']), []);
});

test('gives no hit for a file that matches no glob', (t) => {
  const repo = makeCommittedRepo(t);

  writeFile(repo, '.claude/ashlar-paths', 'secrets/**\n');

  assert.deepEqual(hitsOf(repo, ['a.txt']), []);
});

test('matches a migrations glob against a nested file', (t) => {
  const repo = makeCommittedRepo(t);

  writeFile(repo, '.claude/ashlar-paths', '**/migrations/**\n');

  assert.deepEqual(hitsOf(repo, ['db/migrations/1.sql']), [
    { file: 'db/migrations/1.sql', glob: '**/migrations/**' },
  ]);
});

test('matches a glob at the root when run from a subdirectory', (t) => {
  const repo = makeCommittedRepo(t);

  writeFile(repo, '.claude/ashlar-paths', 'secrets/**\n');
  writeFile(repo, 'sub/c.txt', 'c\n');

  const hits = getRiskHits(
    placeOf(join(repo, 'sub')),
    rangeToWorkingTree(repo),
    ['secrets/key.txt'],
  );

  assert.deepEqual(hits, SECRET_HIT);
});

test('gives a failure for a bad treeish', (t) => {
  const repo = makeCommittedRepo(t);
  const hits = getRiskHits(placeOf(repo), { base: 'nowhere', tree: 'HEAD' }, ['a.txt']);

  assert.ok(isFailure(hits));
});

function hitsOf(repo: string, files: readonly string[]): readonly RiskHit[] {
  const hits = getRiskHits(placeOf(repo), rangeToWorkingTree(repo), files);

  assert.ok(!isFailure(hits), JSON.stringify(hits));

  return hits;
}

function writeFile(repo: string, path: string, content: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

function placeOf(cwd: string): Place {
  return { cwd, env: getGitEnv(process.env), deadline: Number.POSITIVE_INFINITY };
}

function rangeToWorkingTree(repo: string): Range {
  const env = { ...getGitEnv(process.env), GIT_INDEX_FILE: join(repo, '.git', 'temporary-index') };
  const place: Place = { cwd: repo, env, deadline: Number.POSITIVE_INFINITY };

  runGitIn(['add', '-A'], place);

  return { base: 'HEAD', tree: runGitIn(['write-tree'], place).trim() };
}

function runGitIn(args: readonly string[], place: Place): string {
  return execFileSync('git', args, { cwd: place.cwd, encoding: 'utf8', env: place.env });
}
