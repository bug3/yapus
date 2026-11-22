import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isExcluded } from '../../../../hooks/claude/dashes/is-excluded.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

const GIT_ENV = getGitEnv(process.env);
const OTHER_ROOT = '/nowhere/other';
// Sorts before any temporary directory, so a list that ends with it is unsorted.
const INVALID_ORDER_ROOT = '/a/one';

test('excludes a project on the list', (t) => {
  const project = makeTempRepo(t);
  const home = makeHome(t, `${ JSON.stringify([realpathSync(project)]) }\n`);

  assert.equal(isExcluded(project, home, GIT_ENV), true);
});

test('includes a project off the list', (t) => {
  const home = makeHome(t, `${ JSON.stringify([OTHER_ROOT]) }\n`);

  assert.equal(isExcluded(makeTempRepo(t), home, GIT_ENV), false);
});

test('includes a project when there is no list', (t) => {
  assert.equal(isExcluded(makeTempRepo(t), makeTempDir(t), GIT_ENV), false);
});

test('includes a project named by an invalid list', (t) => {
  const project = makeTempRepo(t);
  const home = makeHome(t, `${ JSON.stringify([realpathSync(project), INVALID_ORDER_ROOT]) }\n`);

  assert.equal(isExcluded(project, home, GIT_ENV), false);
});

// A temporary home whose ordo exclusion list holds listText.
function makeHome(t: TestContext, listText: string): string {
  const home = makeTempDir(t);
  const directory = join(home, '.claude', 'yapus', 'ordo');

  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'excluded.json'), listText);

  return home;
}
