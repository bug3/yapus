import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { listModules } from '../../helpers/list-files.ts';
import { getModulesWithoutOwnExport } from './get-modules-without-own-export.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('exports from every module the camelCase of its file name', async () => {
  assert.deepEqual(await getModulesWithoutOwnExport(ROOT, listModules(ROOT)), []);
});
