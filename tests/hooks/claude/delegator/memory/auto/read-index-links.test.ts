import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  readIndexLinks,
} from '../../../../../../hooks/claude/delegator/memory/auto/read-index-links.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';

test('gives the line and the target of a link followed by a colon', () => {
  assert.deepEqual(readIndexLinks('- [T](x.md): hook\n'), [{ line: 1, target: 'x.md' }]);
});

test('gives the line and the target of a link followed by a hyphen', () => {
  assert.deepEqual(readIndexLinks('- [T](x.md) - hook\n'), [{ line: 1, target: 'x.md' }]);
});

test('gives nothing for a line with no link', () => {
  assert.deepEqual(readIndexLinks('- T: hook\n'), []);
});

test('counts the lines from 1 and passes the ones with no link', () => {
  assert.deepEqual(
    readIndexLinks('# Memory\n\n- [A](a.md): first\n- no link\n- [B](b.md) - second\n'),
    [
      { line: 3, target: 'a.md' },
      { line: 5, target: 'b.md' },
    ],
  );
});

test('gives every link of a line that holds two', () => {
  assert.deepEqual(readIndexLinks('- [A](a.md) and [B](b.md): both\n'), [
    { line: 1, target: 'a.md' },
    { line: 1, target: 'b.md' },
  ]);
});

test('gives the target of a link written with ./ before the file without it', () => {
  assert.deepEqual(readIndexLinks('- [C](./c.md): hook\n- [N](./notes/n.md)\n'), [
    { line: 1, target: 'c.md' },
    { line: 2, target: 'notes/n.md' },
  ]);
});

test('gives the target of a link that carries a title without the title', () => {
  assert.deepEqual(readIndexLinks('- [D](d.md "t"): hook\n- [E](./e.md \'the (e)\') - hook\n'), [
    { line: 1, target: 'd.md' },
    { line: 2, target: 'e.md' },
  ]);
});

test('gives nothing for brackets with no target after them', () => {
  assert.deepEqual(readIndexLinks('- [T] (x.md)\n- [T]()\n- [done] x.md\n'), []);
});

test('reads the links of an index file on disk', (t) => {
  const { memoryDirectory } = makeAutoMemory(t, [
    { path: 'MEMORY.md', text: '- [T](x.md): hook\n- [U](y.md) - hook\n' },
  ]);

  assert.deepEqual(readIndexLinks(readFileSync(join(memoryDirectory, 'MEMORY.md'), 'utf8')), [
    { line: 1, target: 'x.md' },
    { line: 2, target: 'y.md' },
  ]);
});
