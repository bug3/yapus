import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getForeignFiles } from './get-foreign-files.ts';

test('finds nothing among TypeScript, markdown, JSON and the shell entries', (t) => {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'hooks'));
  writeFileSync(join(root, 'a.ts'), '');
  writeFileSync(join(root, 'b.md'), '');
  writeFileSync(join(root, 'c.json'), '');
  writeFileSync(join(root, '.gitignore'), '');
  writeFileSync(join(root, 'hooks', 'run.sh'), '');

  assert.deepEqual(getForeignFiles(root), []);
});

test('names a file in another language and a shell script that is not an entry', (t) => {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'a.py'), '');
  writeFileSync(join(root, 'b.sh'), '');

  assert.deepEqual(getForeignFiles(root).sort(), ['a.py', 'b.sh']);
});
