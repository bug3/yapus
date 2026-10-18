import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getRuleFormViolations } from './get-rule-form-violations.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('writes every rule as one heading of one sentence with nothing under it', () => {
  assert.deepEqual(getRuleFormViolations(ROOT), []);
});
