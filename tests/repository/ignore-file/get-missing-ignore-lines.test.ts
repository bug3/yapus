import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { getMissingIgnoreLines } from './get-missing-ignore-lines.ts';

test('finds nothing when the ignore file holds every catalog line', (t) => {
  const root = makeRoot(t, '["a", "!b"]', 'x\na\n!b\n');

  assert.deepEqual(getMissingIgnoreLines(root), []);
});

test('names a catalog line the ignore file lacks', (t) => {
  const root = makeRoot(t, '["a", "!b"]', 'a\n');

  assert.deepEqual(getMissingIgnoreLines(root), ['!b']);
});

test('refuses a catalog that is not an array of strings', (t) => {
  const root = makeRoot(t, '["a", 1]', 'a\n');

  assert.throws(() => getMissingIgnoreLines(root), TypeError);
});

function makeRoot(t: TestContext, catalog: string, ignoreFile: string): string {
  const root = makeTempDir(t);

  mkdirSync(join(root, 'hooks', 'shared', 'catalogs'), { recursive: true });
  writeFileSync(join(root, 'hooks', 'shared', 'catalogs', 'never-commit.json'), catalog);
  writeFileSync(join(root, '.gitignore'), ignoreFile);

  return root;
}
