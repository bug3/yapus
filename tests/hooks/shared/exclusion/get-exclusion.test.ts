import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { getExclusion } from '../../../../hooks/shared/exclusion/get-exclusion.ts';
import { makeLinkedWorktree } from '../../../helpers/exclusion/make-linked-worktree.ts';
import {
  makeHomeWithListText, makeListingHome,
} from '../../../helpers/exclusion/make-listing-home.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';

const GIT_ENV = getGitEnv(process.env);
const OTHER_ROOT = '/nowhere/other';

test('excludes a listed main root', (t) => {
  const repo = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(repo)]);

  assert.deepEqual(getExclusion(repo, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a linked worktree of a listed root', (t) => {
  const repo = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(repo)]);

  assert.deepEqual(getExclusion(makeLinkedWorktree(t, repo), home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a subdirectory of a listed root', (t) => {
  const repo = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(repo)]);
  const subdirectory = join(repo, 'sub');

  mkdirSync(subdirectory);

  assert.deepEqual(getExclusion(subdirectory, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a listed root reached through a symlink', (t) => {
  const repo = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(repo)]);
  const link = join(makeTempDir(t), 'link');

  symlinkSync(repo, link);

  assert.deepEqual(getExclusion(link, home, GIT_ENV), {
    kind: 'excluded',
    root: realpathSync(repo),
  });
});

test('excludes a listed directory outside git', (t) => {
  const directory = makeTempDir(t);
  const home = makeListingHome(t, [realpathSync(directory)]);

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

  const home = makeListingHome(t, [realpathSync(parent)]);

  assert.deepEqual(getExclusion(repo, home, GIT_ENV), { kind: 'included' });
});

test('reports a list that is not JSON as invalid', (t) => {
  const home = makeHomeWithListText(t, '["/a/one",');
  const listPath = getListPath(home);

  assert.deepEqual(getExclusion(makeTempRepo(t), home, GIT_ENV), {
    kind: 'invalid',
    violation: `${ listPath } is not JSON`,
  });
});

test('reports an unsorted list as invalid', (t) => {
  const home = makeHomeWithListText(t, '["/a/two", "/a/one"]\n');
  const listPath = getListPath(home);

  assert.deepEqual(getExclusion(makeTempRepo(t), home, GIT_ENV), {
    kind: 'invalid',
    violation: `${ listPath } is not a sorted array of distinct absolute paths`,
  });
});

test('runs git for an existing directory when the list holds a root', (t) => {
  const home = makeListingHome(t, [OTHER_ROOT]);

  assert.throws(() => getExclusion(makeTempDir(t), home, makeEnvWithoutGit(t)), /ENOENT/);
});

test('includes with no list and no git call', (t) => {
  const home = makeTempDir(t);

  assert.deepEqual(getExclusion(makeTempDir(t), home, makeEnvWithoutGit(t)), {
    kind: 'included',
  });
});

test('includes with an empty list and no git call', (t) => {
  const home = makeListingHome(t, []);

  assert.deepEqual(getExclusion(makeTempDir(t), home, makeEnvWithoutGit(t)), {
    kind: 'included',
  });
});

test('includes an empty directory name with no git call', (t) => {
  const home = makeListingHome(t, [OTHER_ROOT]);

  assert.deepEqual(getExclusion('', home, makeEnvWithoutGit(t)), { kind: 'included' });
});

test('includes a directory that does not exist with no git call', (t) => {
  const home = makeListingHome(t, [OTHER_ROOT]);
  const missing = join(makeTempDir(t), 'missing');

  assert.deepEqual(getExclusion(missing, home, makeEnvWithoutGit(t)), { kind: 'included' });
});

// The path of the exclusion list under home, written out rather than taken
// from the code under test.
function getListPath(home: string): string {
  return join(home, '.claude', 'yapus', 'ordo', 'excluded.json');
}

// An environment whose PATH is an empty directory, so a git call throws.
function makeEnvWithoutGit(t: TestContext): NodeJS.ProcessEnv {
  return { ...GIT_ENV, PATH: makeTempDir(t) };
}
