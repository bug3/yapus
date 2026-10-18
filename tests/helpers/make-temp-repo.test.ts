import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeTempRepo } from './make-temp-repo.ts';
import { runGit } from './run-git.ts';

test('makes an empty git repository', (t) => {
  const tempRepo = makeTempRepo(t);

  assert.equal(runGit(['ls-files'], tempRepo), '');
});

test('gives the repository a local identity', (t) => {
  const tempRepo = makeTempRepo(t);

  assert.equal(runGit(['config', '--local', 'user.name'], tempRepo), 'yapus test\n');
  assert.equal(runGit(['config', '--local', 'user.email'], tempRepo), 'test@example.invalid\n');
});
