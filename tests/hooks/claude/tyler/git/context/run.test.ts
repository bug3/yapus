import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../../../../../hooks/claude/tyler/git/context/run.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';

const FAR_DEADLINE = Date.now() + 600_000;

test('returns the exit code and the output of a run that ends', (t) => {
  const cwd = makeTempRepo(t);
  const result = run('git', ['rev-parse', '--git-dir'], { cwd, deadline: FAR_DEADLINE });

  assert.deepEqual(result, { status: 0, stdout: '.git\n', stderr: '' });
});

test('returns a non-zero exit code for the caller to judge', (t) => {
  const cwd = makeTempRepo(t);
  const result = run('git', ['rev-parse', '--verify', '--quiet', 'nope'], {
    cwd,
    deadline: FAR_DEADLINE,
  });

  assert.deepEqual(result, { status: 1, stdout: '', stderr: '' });
});

test('fails when the tool call names no working directory', () => {
  assert.deepEqual(run('git', ['status'], { cwd: undefined, deadline: FAR_DEADLINE }), {
    failure: 'git status: the tool call names no working directory',
  });
});

test('fails when the deadline is spent', (t) => {
  const cwd = makeTempRepo(t);

  assert.deepEqual(run('git', ['status'], { cwd, deadline: Date.now() - 1 }), {
    failure: 'git status: ran out of its time budget',
  });
});

test('fails when the working directory does not exist', () => {
  const result = run('git', ['status'], { cwd: '/nonexistent/yapus', deadline: FAR_DEADLINE });

  assert.match('failure' in result ? result.failure : '', /^git status: spawnSync git ENOENT/);
});

test('fails instead of throwing when the working directory holds a NUL', () => {
  const result = run('git', ['status'], { cwd: '/tmp\0x', deadline: FAR_DEADLINE });

  assert.match('failure' in result ? result.failure : '', /^git status: /);
});
