import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { makeTempRepo } from './make-temp-repo.ts';

test('makes an empty git repository', (t) => {
  const tempRepo = makeTempRepo(t);

  assert.equal(execFileSync('git', ['ls-files'], { cwd: tempRepo, encoding: 'utf8' }), '');
});
