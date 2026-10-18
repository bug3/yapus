import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getUnpinnedDependencies } from './get-unpinned-dependencies.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('pins every dependency to one version', () => {
  assert.deepEqual(getUnpinnedDependencies(ROOT), []);
});
