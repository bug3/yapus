import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isFailure } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { writeDiff } from '../../../../../../hooks/claude/tyler/ashlar/git/write-diff.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

test('writes the diff of the change to the file', (t) => {
  const repo = makeCommittedRepo(t);
  const out = join(makeTempDir(t), 'change.diff');

  writeFileSync(join(repo, 'a.txt'), 'changed\n');
  commitAll(repo);

  assert.equal(writeDiff(out, placeOf(repo), { base: 'HEAD~1', tree: 'HEAD' }), true);
  assert.match(readFileSync(out, 'utf8'), /^\+changed$/mu);
});

test('creates the parent directory of the file', (t) => {
  const repo = makeCommittedRepo(t);
  const out = join(makeTempDir(t), 'deep', 'er', 'change.diff');

  writeFileSync(join(repo, 'a.txt'), 'changed\n');
  commitAll(repo);
  writeDiff(out, placeOf(repo), { base: 'HEAD~1', tree: 'HEAD' });

  assert.ok(existsSync(out));
});

test('gives a failure and writes no file for a bad id', (t) => {
  const repo = makeCommittedRepo(t);
  const out = join(makeTempDir(t), 'deep', 'change.diff');
  const written = writeDiff(out, placeOf(repo), { base: 'nowhere', tree: 'HEAD' });

  assert.ok(isFailure(written));
  assert.match(written.reason, /^git diff --no-renames .* nowhere HEAD: /);
  assert.ok(!existsSync(join(out, '..')));
});

test('writes the whole diff and leaves no temporary file', (t) => {
  const repo = makeCommittedRepo(t);
  const dir = makeTempDir(t);
  const out = join(dir, 'change.diff');

  writeFileSync(join(repo, 'a.txt'), 'changed\n');
  commitAll(repo);
  writeDiff(out, placeOf(repo), { base: 'HEAD~1', tree: 'HEAD' });

  assert.equal(readFileSync(out, 'utf8'), runGit(['diff', 'HEAD~1', 'HEAD'], repo));
  assert.deepEqual(readdirSync(dir), ['change.diff']);
});

test('writes no color code when color.ui is always', (t) => {
  const repo = makeCommittedRepo(t);
  const out = join(makeTempDir(t), 'change.diff');

  runGit(['config', 'color.ui', 'always'], repo);
  writeFileSync(join(repo, 'a.txt'), 'changed\n');
  commitAll(repo);
  writeDiff(out, placeOf(repo), { base: 'HEAD~1', tree: 'HEAD' });

  assert.equal(readFileSync(out, 'utf8').includes('\u001b'), false);
});

test('writes the whole repository from a subdirectory under diff.relative', (t) => {
  const repo = makeCommittedRepo(t);
  const out = join(makeTempDir(t), 'change.diff');

  mkdirSync(join(repo, 'sub'));
  runGit(['config', 'diff.relative', 'true'], repo);
  writeFileSync(join(repo, 'a.txt'), 'changed\n');
  commitAll(repo);
  writeDiff(out, placeOf(join(repo, 'sub')), { base: 'HEAD~1', tree: 'HEAD' });

  assert.match(readFileSync(out, 'utf8'), /^\+changed$/mu);
});

function placeOf(cwd: string): { cwd: string; env: NodeJS.ProcessEnv } {
  return { cwd, env: getGitEnv(process.env) };
}

function commitAll(repo: string): void {
  runGit(['add', '-A'], repo);
  runGit(['commit', '--quiet', '-m', 'test(fixture): change file'], repo);
}
