import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getEmitViolations } from './get-emit-violations.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('runs as TypeScript on Node 24 or newer and emits no JavaScript', () => {
  assert.deepEqual(getEmitViolations(ROOT), []);
});
