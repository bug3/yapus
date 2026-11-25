import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { listAllFiles } from './list-files.ts';
import { makeTempDir } from './make-temp-dir.ts';
import { makeTempFiles, makeTempRepo } from './make-temp-repo.ts';
import { getCallerGitEnv, runGit } from './run-git.ts';

const SUBPROCESS_TIMEOUT_MS = 10000;

test('makes an empty git repository', (t) => {
  const tempRepo = makeTempRepo(t);

  assert.equal(runGit(['ls-files'], tempRepo), '');
});

test('gives the repository a local identity', (t) => {
  const tempRepo = makeTempRepo(t);

  assert.equal(runGit(['config', '--local', 'user.name'], tempRepo), 'yapus test\n');
  assert.equal(runGit(['config', '--local', 'user.email'], tempRepo), 'test@example.invalid\n');
});

test('keeps the caller\'s global excludes from hiding a file in the repository', (t) => {
  const tempRepo = makeTempRepo(t);
  const home = makeTempDir(t);
  const excludes = join(home, 'excludes');
  const globalConfig = join(home, '.gitconfig');

  writeFileSync(join(tempRepo, 'a.md'), '');
  writeFileSync(excludes, 'a.md\n');
  writeFileSync(globalConfig, `[core]\n\texcludesFile = ${ excludes }\n`);

  const listing = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: tempRepo,
    encoding: 'utf8',
    env: { ...getCallerGitEnv(process.env), GIT_CONFIG_GLOBAL: globalConfig },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(listing, 'a.md\n');
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
