import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getAutoMemoryFile,
} from '../../../../../../hooks/claude/delegator/memory/auto/get-auto-memory-file.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';

const CONFIG = '/home/person/.claude';
const PROJECT = '/home/person/.claude/projects/-work-app';
const MEMORY = '/home/person/.claude/projects/-work-app/memory';

test('gives the index for MEMORY.md in the memory directory of a project', () => {
  assert.deepEqual(getAutoMemoryFile(`${ MEMORY }/MEMORY.md`, CONFIG), {
    kind: 'index',
    memoryDirectory: MEMORY,
  });
});

test('gives a topic file by its name for another Markdown file there', () => {
  assert.deepEqual(getAutoMemoryFile(`${ MEMORY }/x.md`, CONFIG), {
    kind: 'topic',
    memoryDirectory: MEMORY,
    name: 'x',
  });
});

test('finds both under a configuration directory outside the home', () => {
  assert.deepEqual(
    [
      getAutoMemoryFile('/config/projects/-work-app/memory/MEMORY.md', '/config'),
      getAutoMemoryFile('/config/projects/-work-app/memory/x.md', '/config'),
    ],
    [
      { kind: 'index', memoryDirectory: '/config/projects/-work-app/memory' },
      { kind: 'topic', memoryDirectory: '/config/projects/-work-app/memory', name: 'x' },
    ],
  );
});

test('gives the same file for a configuration directory with a trailing slash', () => {
  assert.deepEqual(getAutoMemoryFile(`${ MEMORY }/x.md`, `${ CONFIG }/`), {
    kind: 'topic',
    memoryDirectory: MEMORY,
    name: 'x',
  });
});

test('finds the files of an auto memory on disk', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, [
    { path: 'MEMORY.md', text: '- [T](x.md): hook\n' },
    { path: 'x.md', text: 'text\n' },
  ]);

  assert.deepEqual(
    [
      getAutoMemoryFile(join(memoryDirectory, 'MEMORY.md'), configDirectory),
      getAutoMemoryFile(join(memoryDirectory, 'x.md'), configDirectory),
    ],
    [
      { kind: 'index', memoryDirectory },
      { kind: 'topic', memoryDirectory, name: 'x' },
    ],
  );
});

test('gives none for a transcript beside the memory directory', () => {
  assert.equal(getAutoMemoryFile(`${ PROJECT }/x.jsonl`, CONFIG), undefined);
});

test("gives none for a repository's own memory directory", () => {
  assert.deepEqual(
    [
      getAutoMemoryFile('/work/app/memory/x.md', CONFIG),
      getAutoMemoryFile('/work/app/memory/MEMORY.md', CONFIG),
    ],
    [undefined, undefined],
  );
});

test('gives none for the memory of another home', () => {
  assert.deepEqual(
    [
      getAutoMemoryFile('/home/other/.claude/projects/-work-app/memory/x.md', CONFIG),
      getAutoMemoryFile('/home/other/.claude/projects/-work-app/memory/MEMORY.md', CONFIG),
    ],
    [undefined, undefined],
  );
});

test("gives none for the home's memory when the configuration directory is elsewhere", () => {
  assert.equal(getAutoMemoryFile(`${ MEMORY }/x.md`, '/config'), undefined);
});

test('gives none for the projects, the project and the memory directory', () => {
  assert.deepEqual(
    [
      getAutoMemoryFile(`${ CONFIG }/projects`, CONFIG),
      getAutoMemoryFile(PROJECT, CONFIG),
      getAutoMemoryFile(MEMORY, CONFIG),
    ],
    [undefined, undefined, undefined],
  );
});

test('gives none for a file a level below the memory directory', () => {
  assert.deepEqual(
    [
      getAutoMemoryFile(`${ MEMORY }/notes/x.md`, CONFIG),
      getAutoMemoryFile(`${ MEMORY }/notes.md/x.md`, CONFIG),
    ],
    [undefined, undefined],
  );
});

test('gives none for a directory whose name only starts as the memory directory', () => {
  assert.equal(getAutoMemoryFile(`${ PROJECT }/memory-backup/x.md`, CONFIG), undefined);
});

test('gives none for a file that is not Markdown and for an extension with no name', () => {
  assert.deepEqual(
    [getAutoMemoryFile(`${ MEMORY }/x.txt`, CONFIG), getAutoMemoryFile(`${ MEMORY }/.md`, CONFIG)],
    [undefined, undefined],
  );
});

// A parent step is followed as text, to the place the path leads to.
test('reads a path with a parent step as the place it leads to', () => {
  assert.deepEqual(
    [
      getAutoMemoryFile(`${ MEMORY }/../memory/x.md`, CONFIG),
      getAutoMemoryFile(`${ CONFIG }/projects/../memory/x.md`, CONFIG),
    ],
    [{ kind: 'topic', memoryDirectory: MEMORY, name: 'x' }, undefined],
  );
});

// With the working directory as the configuration directory, a relative path
// would lead into it.
test('gives none for a relative path', () => {
  assert.equal(getAutoMemoryFile('projects/-work-app/memory/x.md', process.cwd()), undefined);
});
