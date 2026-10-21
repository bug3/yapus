import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  run,
  type Place,
  type RunResult,
} from '../../../../../../hooks/claude/tyler/git/context/run.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';

const FAR_DEADLINE = Date.now() + 600_000;

function runGit(args: readonly string[], place: Place, input?: string): RunResult {
  return run({ program: 'git', args, input }, place);
}

test('returns the exit code and the output of a run that ends', (t) => {
  const cwd = makeTempRepo(t);
  const result = runGit(['rev-parse', '--git-dir'], { cwd, deadline: FAR_DEADLINE });

  assert.deepEqual(result, { status: 0, stdout: '.git\n', stderr: '' });
});

test('returns a non-zero exit code for the caller to judge', (t) => {
  const cwd = makeTempRepo(t);
  const result = runGit(['rev-parse', '--verify', '--quiet', 'nope'], {
    cwd,
    deadline: FAR_DEADLINE,
  });

  assert.deepEqual(result, { status: 1, stdout: '', stderr: '' });
});

test('writes the input to stdin', (t) => {
  const cwd = makeTempRepo(t);
  const result = runGit(['hash-object', '--stdin'], { cwd, deadline: FAR_DEADLINE }, 'abc');

  assert.deepEqual(result, {
    status: 0,
    stdout: 'f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f\n',
    stderr: '',
  });
});

test('fails when the tool call names no working directory', () => {
  assert.deepEqual(runGit(['status'], { cwd: undefined, deadline: FAR_DEADLINE }), {
    failure: 'git status: the tool call names no working directory',
  });
});

test('fails when the deadline is spent', (t) => {
  const cwd = makeTempRepo(t);

  assert.deepEqual(runGit(['status'], { cwd, deadline: Date.now() - 1 }), {
    failure: 'git status: ran out of its time budget',
  });
});

test('fails when the working directory does not exist', () => {
  const result = runGit(['status'], { cwd: '/nonexistent/yapus', deadline: FAR_DEADLINE });

  assert.match('failure' in result ? result.failure : '', /^git status: spawnSync git ENOENT/);
});

test('fails instead of throwing when the working directory holds a NUL', () => {
  const result = runGit(['status'], { cwd: '/tmp\0x', deadline: FAR_DEADLINE });

  assert.match('failure' in result ? result.failure : '', /^git status: /);
});
