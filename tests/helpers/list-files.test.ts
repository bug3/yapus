import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { listFiles, listModules } from './list-files.ts';
import { makeTempDir } from './make-temp-dir.ts';

test('lists files by extension, skipping node_modules', (t) => {
  const root = makeTree(t);

  assert.deepEqual(listFiles(root, '.ts').sort(), [
    'eslint.config.ts',
    'hooks/m6/get-name.ts',
    'hooks/m6/main.ts',
    'tests/hooks/m6/get-name.test.ts',
  ]);
});

test('lists modules without tests, entries and tool-named files', (t) => {
  const root = makeTree(t);

  assert.deepEqual(listModules(root), ['hooks/m6/get-name.ts']);
});

function makeTree(t: TestContext): string {
  const root = makeTempDir(t);

  mkdirSync(join(root, 'hooks', 'm6'), { recursive: true });
  mkdirSync(join(root, 'tests', 'hooks', 'm6'), { recursive: true });
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'eslint.config.ts'), '');
  writeFileSync(join(root, 'hooks', 'm6', 'main.ts'), '');
  writeFileSync(join(root, 'hooks', 'm6', 'get-name.ts'), '');
  writeFileSync(join(root, 'tests', 'hooks', 'm6', 'get-name.test.ts'), '');
  writeFileSync(join(root, 'node_modules', 'pkg', 'index.ts'), '');
  writeFileSync(join(root, 'package.json'), '');

  return root;
}
