import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getStandardsPathsViolations } from './get-standards-paths-violations.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('gives every path-loaded standard a paths head and the always-loaded one none', () => {
  assert.deepEqual(getStandardsPathsViolations(ROOT), []);
});
