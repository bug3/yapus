import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { readExclusions } from '../../../../hooks/shared/exclusion/read-exclusions.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const LIST_REFUSAL = 'is not a sorted array of distinct absolute paths';

test('reads the roots of a sorted list of distinct absolute paths', (t) => {
  const path = writeList(t, '["/a/one", "/a/two"]\n');

  assert.deepEqual(readExclusions(path), { roots: ['/a/one', '/a/two'] });
});

test('reads an empty array as no roots', (t) => {
  const path = writeList(t, '[]\n');

  assert.deepEqual(readExclusions(path), { roots: [] });
});

test('reads a missing file as no roots', (t) => {
  const path = join(makeTempDir(t), 'excluded.json');

  assert.deepEqual(readExclusions(path), { roots: [] });
});

test('refuses a file that cannot be read', (t) => {
  const path = makeTempDir(t);

  assert.deepEqual(readExclusions(path), { violation: `${ path } cannot be read` });
});

test('refuses a file that is not JSON', (t) => {
  const path = writeList(t, '["/a/one",');

  assert.deepEqual(readExclusions(path), { violation: `${ path } is not JSON` });
});

test('refuses JSON that is not an array', (t) => {
  const path = writeList(t, '{"/a/one": true}\n');

  assert.deepEqual(readExclusions(path), { violation: `${ path } ${ LIST_REFUSAL }` });
});

test('refuses a relative path', (t) => {
  const path = writeList(t, '["a/one"]\n');

  assert.deepEqual(readExclusions(path), { violation: `${ path } ${ LIST_REFUSAL }` });
});

test('refuses an entry that is not a string', (t) => {
  const path = writeList(t, '[1]\n');

  assert.deepEqual(readExclusions(path), { violation: `${ path } ${ LIST_REFUSAL }` });
});

test('refuses an unsorted list', (t) => {
  const path = writeList(t, '["/a/two", "/a/one"]\n');

  assert.deepEqual(readExclusions(path), { violation: `${ path } ${ LIST_REFUSAL }` });
});

test('refuses a duplicate path', (t) => {
  const path = writeList(t, '["/a/one", "/a/one"]\n');

  assert.deepEqual(readExclusions(path), { violation: `${ path } ${ LIST_REFUSAL }` });
});

function writeList(t: TestContext, listText: string): string {
  const path = join(makeTempDir(t), 'excluded.json');

  writeFileSync(path, listText);

  return path;
}
