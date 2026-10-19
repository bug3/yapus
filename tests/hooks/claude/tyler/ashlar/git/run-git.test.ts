import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  failed,
  getOutput,
  isFailure,
  runGit,
} from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';
import { runGit as runHelperGit } from '../../../../../helpers/run-git.ts';

test('returns the exit status and stdout of a zero exit', (t) => {
  const repo = makeTempRepo(t);

  const run = runGit(['rev-parse', '--is-inside-work-tree'], { cwd: repo, env: process.env });

  assert.deepEqual(run, { status: 0, stdout: 'true\n', stderr: '' });
});

test('returns a non-zero exit with its stderr as a run, not a failure', (t) => {
  const dir = makeTempDir(t);
  const run = runGit(['rev-parse', 'HEAD'], { cwd: dir, env: { ...process.env, GIT_DIR: dir } });

  assert.ok(!isFailure(run));
  assert.equal(run.status, 128);
  assert.match(run.stderr, /not a git repository/);
});

test('turns a spawn error into a failure that names the command', (t) => {
  const missing = join(makeTempDir(t), 'missing');
  const run = runGit(['status'], { cwd: missing, env: process.env });

  assert.ok(isFailure(run));
  assert.match(run.reason, /^git status: spawnSync git ENOENT/);
});

test('gives the trimmed stdout of a zero exit', (t) => {
  const repo = makeTempRepo(t);
  const place = { cwd: repo, env: process.env };

  assert.equal(getOutput(['rev-parse', '--is-inside-work-tree'], place), 'true');
});

test('gives a failure with the first stderr line for a non-zero exit', (t) => {
  const repo = makeTempRepo(t);
  const output = getOutput(['rev-parse', '--verify', 'nope'], { cwd: repo, env: process.env });

  assert.deepEqual(output, {
    kind: 'failure',
    reason: 'git rev-parse --verify nope: fatal: Needed a single revision',
  });
});

test('words a failure as the git command, a colon and the detail', () => {
  assert.deepEqual(failed(['rev-parse', 'HEAD'], 'fatal: bad'), {
    kind: 'failure',
    reason: 'git rev-parse HEAD: fatal: bad',
  });
});

test('returns output over one mebibyte whole', (t) => {
  const repo = makeTempRepo(t);

  writeFileSync(join(repo, 'big.txt'), 'x'.repeat(2 * 1024 * 1024));

  const blob = runHelperGit(['hash-object', '-w', 'big.txt'], repo).trim();
  const run = runGit(['cat-file', '-p', blob], { cwd: repo, env: process.env });

  assert.ok(!isFailure(run));
  assert.equal(run.stdout.length, 2 * 1024 * 1024);
});
