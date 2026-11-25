import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getForeignFiles } from './get-foreign-files.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('writes everything in one language but its shell entries', () => {
  assert.deepEqual(getForeignFiles(ROOT), []);
});
