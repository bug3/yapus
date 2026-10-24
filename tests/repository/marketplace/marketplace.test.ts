import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getMarketplaceProblems } from './get-marketplace-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('lists every plugin from its own directory, with its version in the manifest', () => {
  assert.deepEqual(getMarketplaceProblems(ROOT), []);
});
