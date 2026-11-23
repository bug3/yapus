import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIRECTORIES,
  getMemoryDirectory,
} from '../../../../../hooks/claude/delegator/memory/get-memory-directory.ts';

test('names the memory directory under .yapus in the project root', () => {
  assert.equal(getMemoryDirectory('/work/app'), '/work/app/.yapus/memory');
});

test('holds work, rules and reference as the directories of a memory', () => {
  assert.deepEqual(DIRECTORIES, ['work', 'rules', 'reference']);
});
