import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getMissingIgnoreLines } from './get-missing-ignore-lines.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('holds every never-commit line in its own ignore file', () => {
  assert.deepEqual(getMissingIgnoreLines(ROOT), []);
});
