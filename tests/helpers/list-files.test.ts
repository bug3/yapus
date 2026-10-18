import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { listFiles, listModules } from './list-files.ts';
import { makeTempRepo } from './make-temp-repo.ts';
import { runGit } from './run-git.ts';

test('lists untracked files by extension, relative to the root', (t) => {
  const root = makeTree(t);

  assert.deepEqual(listFiles(root, '.ts').sort(), [
    'eslint.config.ts',
    'hooks/dashes/get-name.ts',
    'hooks/dashes/main.ts',
    'tests/hooks/dashes/get-name.test.ts',
  ]);
});

test('lists tracked files beside untracked ones', (t) => {
  const root = makeTree(t);

  runGit(['add', 'package.json'], root);

  assert.deepEqual(listFiles(root, '.json').sort(), [
    'node_modules/pkg/package.json',
    'package.json',
  ]);
});

test('skips the files git ignores', (t) => {
  const root = makeTree(t);

  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');

  assert.deepEqual(listFiles(root, '.json'), ['package.json']);
});

test('skips a tracked file deleted from disk', (t) => {
  const root = makeTree(t);

  runGit(['add', 'package.json'], root);
  rmSync(join(root, 'package.json'));

  assert.deepEqual(listFiles(root, '.json'), ['node_modules/pkg/package.json']);
});

test('lists modules without tests, entries and tool-named files', (t) => {
  const root = makeTree(t);

  assert.deepEqual(listModules(root), ['hooks/dashes/get-name.ts']);
});

function makeTree(t: TestContext): string {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'hooks', 'dashes'), { recursive: true });
  mkdirSync(join(root, 'tests', 'hooks', 'dashes'), { recursive: true });
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'eslint.config.ts'), '');
  writeFileSync(join(root, 'hooks', 'dashes', 'main.ts'), '');
  writeFileSync(join(root, 'hooks', 'dashes', 'get-name.ts'), '');
  writeFileSync(join(root, 'tests', 'hooks', 'dashes', 'get-name.test.ts'), '');
  writeFileSync(join(root, 'node_modules', 'pkg', 'package.json'), '');
  writeFileSync(join(root, 'package.json'), '');

  return root;
}
