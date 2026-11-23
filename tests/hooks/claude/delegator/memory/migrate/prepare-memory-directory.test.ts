import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  prepareMemoryDirectory,
} from '../../../../../../hooks/claude/delegator/memory/migrate/prepare-memory-directory.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { readTree } from './read-tree.ts';

test('creates the memory directory with its three directories and an ignore file', (t) => {
  const projectRoot = makeTempDir(t);
  const memoryDirectory = join(projectRoot, '.yapus', 'memory');

  assert.deepEqual(prepareMemoryDirectory(projectRoot), { kind: 'created' });
  assert.deepEqual(
    readdirSync(memoryDirectory).sort(),
    ['.gitignore', 'reference', 'rules', 'work'],
  );
  assert.equal(readFileSync(join(memoryDirectory, '.gitignore'), 'utf8'), '*\n');
});

test('gives present for a memory directory that exists and creates what it lacks', (t) => {
  const projectRoot = makeMemoryProject(t, [{ path: 'rules/a.md', text: 'a rule\n' }]);

  assert.deepEqual(prepareMemoryDirectory(projectRoot), { kind: 'present' });
  assert.deepEqual(
    readdirSync(join(projectRoot, '.yapus', 'memory')).sort(),
    ['.gitignore', 'reference', 'rules', 'work'],
  );
});

test('leaves an ignore file with other content and every other file as it is', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: '.gitignore', text: '!rules/\n' },
    { path: 'rules/a.md', text: 'a rule\n' },
  ]);

  prepareMemoryDirectory(projectRoot);

  assert.deepEqual(readTree(join(projectRoot, '.yapus', 'memory')), [
    ['.gitignore', '!rules/\n'],
    ['rules/a.md', 'a rule\n'],
  ]);
});

test('fails on a project root that is no directory and creates nothing', (t) => {
  const projectRoot = join(makeTempDir(t), 'gone');

  assert.deepEqual(prepareMemoryDirectory(projectRoot), {
    kind: 'failure',
    detail: `${ projectRoot } is not a directory; give the absolute path of the project, `
      + 'nothing changed',
  });
  assert.equal(existsSync(projectRoot), false);
});

test('fails where a file stands in the place of the memory directory', (t) => {
  const projectRoot = makeTempDir(t);
  const memoryDirectory = join(projectRoot, '.yapus', 'memory');

  mkdirSync(join(projectRoot, '.yapus'));
  writeFileSync(memoryDirectory, 'a file\n');

  const prepared = prepareMemoryDirectory(projectRoot);

  assert.ok(prepared.kind === 'failure');
  assert.match(
    prepared.detail,
    /^cannot create .*\.yapus\/memory: E[A-Z]+[^\n]*; repair it and run the command again$/u,
  );
  assert.equal(readFileSync(memoryDirectory, 'utf8'), 'a file\n');
});
