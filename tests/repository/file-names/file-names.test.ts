import assert from 'node:assert/strict';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { listFiles } from '../../helpers/list-files.ts';
import { isKebabCase } from './is-kebab-case.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('names every TypeScript file in kebab-case', () => {
  const fileNames = listFiles(ROOT, '.ts').map((path) => basename(path, '.ts'));

  assert.deepEqual(fileNames.filter((fileName) => !isKebabCase(fileName)), []);
});
