import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getFoldersOverLimit } from './get-folders-over-limit.ts';

test('counts the files of a folder but not its subfolders', (t) => {
  const root = makeTreeOfThreeAndTwo(t);

  assert.deepEqual(getFoldersOverLimit(root, 3, []), []);
});

test('names each folder past the limit with its file count, sorted', (t) => {
  const root = makeTreeOfThreeAndTwo(t);

  assert.deepEqual(getFoldersOverLimit(root, 1, []), ['.: 3 files', 'docs: 2 files']);
});

test('skips a collection past the limit', (t) => {
  const root = makeTreeOfThreeAndTwo(t);

  assert.deepEqual(getFoldersOverLimit(root, 1, ['docs']), ['.: 3 files']);
});

test('still caps a subfolder of a collection', (t) => {
  const root = makeTreeOfThreeAndTwo(t);

  mkdirSync(join(root, 'docs', 'sub'));
  writeFileSync(join(root, 'docs', 'sub', 'f.md'), '');
  writeFileSync(join(root, 'docs', 'sub', 'g.md'), '');

  assert.deepEqual(getFoldersOverLimit(root, 1, ['docs']), ['.: 3 files', 'docs/sub: 2 files']);
});

// Three files and the subfolder docs/ at the root, two files in docs/;
// docs/ comes before the root's files in a sorted listing.
function makeTreeOfThreeAndTwo(t: TestContext): string {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'x.ts'), '');
  writeFileSync(join(root, 'y.json'), '');
  writeFileSync(join(root, 'z.md'), '');
  writeFileSync(join(root, 'docs', 'd.md'), '');
  writeFileSync(join(root, 'docs', 'e.md'), '');

  return root;
}
