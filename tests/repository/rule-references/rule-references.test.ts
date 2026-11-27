import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getRuleReferenceProblems } from './get-rule-reference-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('names an existing rule with every rule ID a file cites', () => {
  assert.deepEqual(getRuleReferenceProblems(ROOT), []);
});
