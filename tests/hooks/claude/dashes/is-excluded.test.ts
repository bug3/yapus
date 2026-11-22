import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { test } from 'node:test';
import { isExcluded } from '../../../../hooks/claude/dashes/is-excluded.ts';
import { makeListingHome } from '../../../helpers/exclusion/make-listing-home.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

const GIT_ENV = getGitEnv(process.env);
const OTHER_ROOT = '/nowhere/other';
// Sorts before any temporary directory, so a list that ends with it is unsorted.
const INVALID_ORDER_ROOT = '/a/one';

test('excludes a project on the list', (t) => {
  const project = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(project)]);

  assert.equal(isExcluded(project, home, GIT_ENV), true);
});

test('includes a project off the list', (t) => {
  const home = makeListingHome(t, [OTHER_ROOT]);

  assert.equal(isExcluded(makeTempRepo(t), home, GIT_ENV), false);
});

test('includes a project when there is no list', (t) => {
  assert.equal(isExcluded(makeTempRepo(t), makeTempDir(t), GIT_ENV), false);
});

test('includes a project named by an invalid list', (t) => {
  const project = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(project), INVALID_ORDER_ROOT]);

  assert.equal(isExcluded(project, home, GIT_ENV), false);
});
