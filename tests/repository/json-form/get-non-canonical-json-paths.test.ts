import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getNonCanonicalJsonPaths } from './get-non-canonical-json-paths.ts';

test('finds nothing when every JSON file is in the canonical form', (t) => {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'a.json'), '{\n  "a": 1\n}\n');

  assert.deepEqual(getNonCanonicalJsonPaths(root), []);
});

test('names a JSON file that is not in the canonical form', (t) => {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'a.json'), '{"a":1}');

  assert.deepEqual(getNonCanonicalJsonPaths(root), ['a.json']);
});

test('names a JSON file that is not UTF-8', (t) => {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'a.json'), Buffer.from('{}\n', 'utf16le'));

  assert.deepEqual(getNonCanonicalJsonPaths(root), ['a.json']);
});
