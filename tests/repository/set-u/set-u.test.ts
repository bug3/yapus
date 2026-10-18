import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getSetUViolations } from './get-set-u-violations.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('starts every bash script with set -u and leaves set -e off', () => {
  assert.deepEqual(getSetUViolations(ROOT), []);
});
