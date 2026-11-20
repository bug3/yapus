import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getForeignFiles } from './get-foreign-files.ts';

test('finds nothing among kept formats, shell entries and YAML under .github', (t) => {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'hooks'));
  mkdirSync(join(root, '.github'));
  writeFileSync(join(root, 'a.ts'), '');
  writeFileSync(join(root, 'b.md'), '');
  writeFileSync(join(root, 'c.json'), '');
  writeFileSync(join(root, '.gitignore'), '');
  writeFileSync(join(root, 'LICENSE'), '');
  writeFileSync(join(root, 'hooks', 'run.sh'), '');
  writeFileSync(join(root, '.github', 'd.yml'), '');

  assert.deepEqual(getForeignFiles(root), []);
});

test('names another language, a stray shell script and YAML outside .github', (t) => {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'a.py'), '');
  writeFileSync(join(root, 'b.sh'), '');
  writeFileSync(join(root, 'c.yml'), '');

  assert.deepEqual(getForeignFiles(root).sort(), ['a.py', 'b.sh', 'c.yml']);
});

test('finds nothing for a workflow script of a plugin', (t) => {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'plugins', 'x', 'workflows'), { recursive: true });
  writeFileSync(join(root, 'plugins', 'x', 'workflows', 'a.js'), '');

  assert.deepEqual(getForeignFiles(root), []);
});

test('names JavaScript that is not a workflow script of a plugin', (t) => {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'plugins', 'x', 'workflows', 'sub'), { recursive: true });
  writeFileSync(join(root, 'a.js'), '');
  writeFileSync(join(root, 'plugins', 'x', 'a.js'), '');
  writeFileSync(join(root, 'plugins', 'x', 'workflows', 'sub', 'a.js'), '');
  writeFileSync(join(root, 'plugins', 'x', 'workflows', 'a.mjs'), '');

  assert.deepEqual(getForeignFiles(root).sort(), [
    'a.js',
    'plugins/x/a.js',
    'plugins/x/workflows/a.mjs',
    'plugins/x/workflows/sub/a.js',
  ]);
});
