import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getVersionBumpProblems } from './get-version-bump-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('bumps the delegator version when the shipped files change', () => {
  assert.deepEqual(getVersionBumpProblems(ROOT), []);
});
