import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  failed,
  isFailure,
  type Place,
  runGit,
} from '../../../../hooks/git/branch/run-git.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { runGit as runHelperGit } from '../../../helpers/run-git.ts';

test('returns the exit status and stdout of a zero exit', (t) => {
  const repo = makeTempRepo(t);

  const run = runGit(['rev-parse', '--is-inside-work-tree'], placeOf(repo, process.env));

  assert.deepEqual(run, { status: 0, stdout: 'true\n', stderr: '' });
});

test('returns a non-zero exit with its stderr as a run, not a failure', (t) => {
  const dir = makeTempDir(t);
  const run = runGit(['rev-parse', 'HEAD'], placeOf(dir, { ...process.env, GIT_DIR: dir }));

  assert.ok(!isFailure(run));
  assert.equal(run.status, 128);
  assert.match(run.stderr, /not a git repository/);
});

test('turns a spawn error into a failure that names the command', (t) => {
  const missing = join(makeTempDir(t), 'missing');
  const run = runGit(['status'], placeOf(missing, process.env));

  assert.ok(isFailure(run));
  assert.match(run.reason, /^git status: spawnSync git ENOENT/);
});

test('words a failure as the git command, a colon and the detail', () => {
  assert.deepEqual(failed(['rev-parse', 'HEAD'], 'fatal: bad'), {
    kind: 'failure',
    reason: 'git rev-parse HEAD: fatal: bad',
  });
});

test('gives the budget failure without starting git once the deadline passed', (t) => {
  const missing = join(makeTempDir(t), 'missing');
  const run = runGit(['status'], { cwd: missing, env: process.env, deadline: Date.now() - 1 });

  assert.deepEqual(run, { kind: 'failure', reason: 'git status: ran out of its time budget' });
});

test('returns output over one mebibyte whole', (t) => {
  const repo = makeTempRepo(t);

  writeFileSync(join(repo, 'big.txt'), 'x'.repeat(2 * 1024 * 1024));

  const blob = runHelperGit(['hash-object', '-w', 'big.txt'], repo).trim();
  const run = runGit(['cat-file', '-p', blob], placeOf(repo, process.env));

  assert.ok(!isFailure(run));
  assert.equal(run.stdout.length, 2 * 1024 * 1024);
});

function placeOf(cwd: string, env: NodeJS.ProcessEnv): Place {
  return { cwd, env, deadline: Number.POSITIVE_INFINITY };
}
