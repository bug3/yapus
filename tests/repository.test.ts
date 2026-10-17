import assert from 'node:assert/strict';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { isKebabCase } from './support/is-kebab-case.ts';
import { listFiles } from './support/list-files.ts';

const ROOT = join(import.meta.dirname, '..');

test('names every TypeScript file in kebab-case', () => {
  const fileNames = listFiles(ROOT, '.ts').map((path) => basename(path, '.ts'));

  assert.deepEqual(fileNames.filter((fileName) => !isKebabCase(fileName)), []);
});
