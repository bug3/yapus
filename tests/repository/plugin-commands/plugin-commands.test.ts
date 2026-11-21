import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getCommandFileProblems } from './get-command-file-problems.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('keeps no command file in a plugin', () => {
  assert.deepEqual(getCommandFileProblems(ROOT), []);
});
