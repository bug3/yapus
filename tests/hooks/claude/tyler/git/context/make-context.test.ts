import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeContext } from '../../../../../../hooks/claude/tyler/git/context/make-context.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';

test('keeps the working directory', () => {
  assert.equal(makeContext('/repo').cwd, '/repo');
  assert.equal(makeContext(undefined).cwd, undefined);
});

test('runs a program in the working directory', (t) => {
  const context = makeContext(makeTempRepo(t));

  assert.deepEqual(context.run('git', ['rev-parse', '--git-dir']), {
    status: 0,
    stdout: '.git\n',
    stderr: '',
  });
});

test('fails a run when there is no working directory', () => {
  assert.deepEqual(makeContext(undefined).run('git', ['status']), {
    failure: 'git status: the tool call names no working directory',
  });
});
