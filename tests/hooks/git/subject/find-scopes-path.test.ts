import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { findScopesPath } from '../../../../hooks/git/subject/find-scopes-path.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

test('prefers the scope catalog next to the code', (t) => {
  const { catalogs, repository } = makeLayout(t);

  writeFileSync(join(catalogs, 'scopes.json'), '[]');
  mkdirSync(join(repository, '.landmark'));
  writeFileSync(join(repository, '.landmark', 'scopes.json'), '[]');

  assert.equal(findScopesPath(catalogs, repository), join(catalogs, 'scopes.json'));
});

test('falls back to the scope catalog of the repository', (t) => {
  const { catalogs, repository } = makeLayout(t);

  mkdirSync(join(repository, '.landmark'));
  writeFileSync(join(repository, '.landmark', 'scopes.json'), '[]');

  assert.equal(
    findScopesPath(catalogs, repository),
    join(repository, '.landmark', 'scopes.json'),
  );
});

test('finds no scope catalog when neither exists', (t) => {
  const { catalogs, repository } = makeLayout(t);

  assert.equal(findScopesPath(catalogs, repository), undefined);
});

function makeLayout(t: TestContext): { catalogs: string; repository: string } {
  const root = makeTempDir(t);
  const catalogs = join(root, 'catalogs');
  const repository = join(root, 'repository');

  mkdirSync(catalogs);
  mkdirSync(repository);

  return { catalogs, repository };
}
