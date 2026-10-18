import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { listFiles } from '../../helpers/list-files.ts';
import { getCrossingImports } from './get-crossing-imports.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

// Every TypeScript file, entry files included: an entry is where a stray
// import is most likely.
test('keeps the claude hooks and the git hooks from importing each other', () => {
  assert.deepEqual(getCrossingImports(ROOT, listFiles(ROOT, '.ts')), []);
});
