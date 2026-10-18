import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getAgentProblems } from './get-agent-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('keeps every agent definition within the roster limits', () => {
  assert.deepEqual(getAgentProblems(ROOT), []);
});
