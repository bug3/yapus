import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getFoldersOverLimit } from './get-folders-over-limit.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

// An alarm for E31, not a reason to split: a folder past it is split by
// E31 or listed below as a collection.
const MAX_FILES_PER_FOLDER = 10;

// Folders, relative to the root, that E33 keeps flat with one file per
// case; no limit applies to them. `.claude/rules` holds one link per
// standard with paths, `docs/standards` one page per standard.
const COLLECTIONS: readonly string[] = ['standards', '.claude/rules', 'docs/standards'];

test('holds at most the file limit in every folder but a collection', () => {
  assert.deepEqual(getFoldersOverLimit(ROOT, MAX_FILES_PER_FOLDER, COLLECTIONS), []);
});
