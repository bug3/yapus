import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  CATALOGS_PATH,
  readRepositoryCatalogs,
} from '../../../../../../hooks/claude/tyler/gh/rules/read-repository-catalogs.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCatalogRoot } from '../make-catalog-root.ts';

test('reads the catalogs of the directory that holds them', async (t) => {
  const catalogs = await readRepositoryCatalogs(makeCatalogRoot(t));

  assert.ok(catalogs !== undefined && 'scopes' in catalogs && catalogs.scopes.words.length > 0);
});

test('reads the catalogs of an ancestor of a nested directory', async (t) => {
  const nested = join(makeCatalogRoot(t), 'x', 'y');

  mkdirSync(nested, { recursive: true });

  const catalogs = await readRepositoryCatalogs(nested);

  assert.ok(catalogs !== undefined && 'labels' in catalogs);
});

test('gives undefined for a directory with no catalogs above it', async (t) => {
  assert.equal(await readRepositoryCatalogs(makeTempDir(t)), undefined);
});

test('gives undefined for an unknown directory', async () => {
  assert.equal(await readRepositoryCatalogs(undefined), undefined);
});

test('names a catalog that cannot be read', async (t) => {
  const root = makeCatalogRoot(t);
  const path = join(root, CATALOGS_PATH, 'scopes.json');

  writeFileSync(path, 'nope\n');

  assert.deepEqual(await readRepositoryCatalogs(root), {
    violation: `${ path } is not JSON; blocked until the catalog is fixed`,
  });
});
