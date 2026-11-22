import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { getExclusion } from '../../../../hooks/shared/exclusion/get-exclusion.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';

const GIT_ENV = getGitEnv(process.env);
const OTHER_ROOT = '/nowhere/other';

test('excludes a listed main root', (t) => {
  const repo = makeTempRepo(t);
  const home = makeHome(t, [realpathSync(repo)]);

  assert.deepEqual(getExclusion(repo, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a linked worktree of a listed root', (t) => {
  const repo = makeTempRepo(t);
  const home = makeHome(t, [realpathSync(repo)]);

  assert.deepEqual(getExclusion(makeLinkedWorktree(t, repo), home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a subdirectory of a listed root', (t) => {
  const repo = makeTempRepo(t);
  const home = makeHome(t, [realpathSync(repo)]);
  const subdirectory = join(repo, 'sub');

  mkdirSync(subdirectory);

  assert.deepEqual(getExclusion(subdirectory, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a listed root reached through a symlink', (t) => {
  const repo = makeTempRepo(t);
  const home = makeHome(t, [realpathSync(repo)]);
  const link = join(makeTempDir(t), 'link');

  symlinkSync(repo, link);

  assert.deepEqual(getExclusion(link, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a listed directory outside git', (t) => {
  const directory = makeTempDir(t);
  const home = makeHome(t, [realpathSync(directory)]);

  assert.deepEqual(getExclusion(directory, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(directory),
  });
});

test('includes an unlisted repository whose parent is listed', (t) => {
  const parent = makeTempDir(t);
  const repo = join(parent, 'child');

  mkdirSync(repo);
  runGit(['init', '--quiet'], repo);

  const home = makeHome(t, [realpathSync(parent)]);

  assert.deepEqual(getExclusion(repo, home, GIT_ENV), { kind: 'included' });
});

test('reports a list that is not JSON as invalid', (t) => {
  const home = makeTempDir(t);
  const listPath = writeListText(home, '["/a/one",');

  assert.deepEqual(getExclusion(makeTempRepo(t), home, GIT_ENV), {
    kind: 'invalid',
    violation: `${ listPath } is not JSON`,
  });
});

test('reports an unsorted list as invalid', (t) => {
  const home = makeTempDir(t);
  const listPath = writeListText(home, '["/a/two", "/a/one"]\n');

  assert.deepEqual(getExclusion(makeTempRepo(t), home, GIT_ENV), {
    kind: 'invalid',
    violation: `${ listPath } is not a sorted array of distinct absolute paths`,
  });
});

test('runs git for an existing directory when the list holds a root', (t) => {
  const home = makeHome(t, [OTHER_ROOT]);

  assert.throws(() => getExclusion(makeTempDir(t), home, makeEnvWithoutGit(t)), /ENOENT/);
});

test('includes with no list and no git call', (t) => {
  const home = makeTempDir(t);

  assert.deepEqual(getExclusion(makeTempDir(t), home, makeEnvWithoutGit(t)), {
    kind: 'included',
  });
});

test('includes with an empty list and no git call', (t) => {
  const home = makeHome(t, []);

  assert.deepEqual(getExclusion(makeTempDir(t), home, makeEnvWithoutGit(t)), {
    kind: 'included',
  });
});

test('includes an empty directory name with no git call', (t) => {
  const home = makeHome(t, [OTHER_ROOT]);

  assert.deepEqual(getExclusion('', home, makeEnvWithoutGit(t)), { kind: 'included' });
});

test('includes a directory that does not exist with no git call', (t) => {
  const home = makeHome(t, [OTHER_ROOT]);
  const missing = join(makeTempDir(t), 'missing');

  assert.deepEqual(getExclusion(missing, home, makeEnvWithoutGit(t)), { kind: 'included' });
});

// A temporary home whose exclusion list holds roots.
function makeHome(t: TestContext, roots: readonly string[]): string {
  const home = makeTempDir(t);

  writeListText(home, `${ JSON.stringify(roots) }\n`);

  return home;
}

function writeListText(home: string, listText: string): string {
  const directory = join(home, '.claude', 'yapus', 'ordo');
  const listPath = join(directory, 'excluded.json');

  mkdirSync(directory, { recursive: true });
  writeFileSync(listPath, listText);

  return listPath;
}

function makeLinkedWorktree(t: TestContext, repo: string): string {
  const worktree = join(makeTempDir(t), 'worktree');

  runGit(['commit', '--quiet', '--allow-empty', '-m', 'start'], repo);
  runGit(['worktree', 'add', '--quiet', '-b', 'linked', worktree], repo);

  return worktree;
}

// An environment whose PATH is an empty directory, so a git call throws.
function makeEnvWithoutGit(t: TestContext): NodeJS.ProcessEnv {
  return { ...GIT_ENV, PATH: makeTempDir(t) };
}
