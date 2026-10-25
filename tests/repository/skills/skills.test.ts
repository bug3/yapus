import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getSkillProblems } from './get-skill-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('keeps every plugin skill loadable', () => {
  assert.deepEqual(getSkillProblems(ROOT), []);
});
