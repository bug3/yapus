import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getRulesLinkProblems } from './get-rules-link-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('links every standard with paths under .claude/rules', () => {
  assert.deepEqual(getRulesLinkProblems(ROOT), []);
});
