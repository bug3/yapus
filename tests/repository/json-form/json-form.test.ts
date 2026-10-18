import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getNonCanonicalJsonPaths } from './get-non-canonical-json-paths.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('writes every JSON file in the D2 form', () => {
  assert.deepEqual(getNonCanonicalJsonPaths(ROOT), []);
});
