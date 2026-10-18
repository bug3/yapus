import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { readCatalog } from '../../../../hooks/git/subject/read-catalog.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const CATALOGS = join(
  import.meta.dirname, '..', '..', '..', '..', 'hooks', 'git', 'subject', 'catalogs',
);
const READ_KEYS: readonly string[] = ['path', 'words'];
const LIST_REFUSAL = 'is not a sorted array of distinct lowercase words';
const BLOCK = 'the commit is blocked until the catalog is fixed';

test('reads the words of a sorted list of distinct lowercase words', async (t) => {
  const path = writeCatalog(t, '["add", "fix"]\n');

  assert.deepEqual(await readCatalog(path, 'verb'), { path, words: ['add', 'fix'] });
});

test('reads a scope with a digit or a hyphen', async (t) => {
  const path = writeCatalog(t, '["git-hooks", "m6"]\n');

  assert.deepEqual(await readCatalog(path, 'scope'), {
    path,
    words: ['git-hooks', 'm6'],
  });
});

test('refuses a verb with a hyphen, which a subject cannot match', async (t) => {
  const path = writeCatalog(t, '["ci-cd"]\n');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } ${ LIST_REFUSAL }; ${ BLOCK }`,
  });
});

test('refuses a missing file', async (t) => {
  const path = join(makeTempDir(t), 'missing.json');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } cannot be read; ${ BLOCK }`,
  });
});

test('refuses a file that is not JSON', async (t) => {
  const path = writeCatalog(t, '["add",');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } is not JSON; ${ BLOCK }`,
  });
});

test('refuses JSON that is not an array', async (t) => {
  const path = writeCatalog(t, '{"add": true}\n');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } ${ LIST_REFUSAL }; ${ BLOCK }`,
  });
});

test('refuses an uppercase word', async (t) => {
  const path = writeCatalog(t, '["Add", "fix"]\n');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } ${ LIST_REFUSAL }; ${ BLOCK }`,
  });
});

test('refuses a duplicate word', async (t) => {
  const path = writeCatalog(t, '["add", "add"]\n');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } ${ LIST_REFUSAL }; ${ BLOCK }`,
  });
});

test('refuses an unsorted list', async (t) => {
  const path = writeCatalog(t, '["fix", "add"]\n');

  assert.deepEqual(await readCatalog(path, 'verb'), {
    violation: `${ path } ${ LIST_REFUSAL }; ${ BLOCK }`,
  });
});

test('reads the three catalogs of the program without violation', async () => {
  const types = await readCatalog(join(CATALOGS, 'types.json'), 'type');
  const scopes = await readCatalog(join(CATALOGS, 'scopes.json'), 'scope');
  const verbs = await readCatalog(join(CATALOGS, 'verbs.json'), 'verb');

  assert.deepEqual(
    [Object.keys(types), Object.keys(scopes), Object.keys(verbs)],
    [READ_KEYS, READ_KEYS, READ_KEYS],
  );
});

function writeCatalog(t: TestContext, catalogText: string): string {
  const path = join(makeTempDir(t), 'words.json');

  writeFileSync(path, catalogText);

  return path;
}
