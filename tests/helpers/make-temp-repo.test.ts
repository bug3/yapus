import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { listAllFiles } from './list-files.ts';
import { makeTempFiles, makeTempRepo } from './make-temp-repo.ts';
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

test('writes each file with its text, making its directories', (t) => {
  const root = makeTempFiles(t, [
    { path: 'a.md', text: 'a\n' },
    { path: 'b/c/d.md', text: '' },
  ]);

  assert.deepEqual(
    listAllFiles(root).sort().map((path) => [path, readFileSync(join(root, path), 'utf8')]),
    [['a.md', 'a\n'], ['b/c/d.md', '']],
  );
});

test('makes an empty git repository for no files', (t) => {
  const root = makeTempFiles(t, []);

  assert.deepEqual(listAllFiles(root), []);
});
