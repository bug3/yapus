import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  readSorting,
} from '../../../../../hooks/claude/delegator/memory/sorting/read-sorting.ts';
import { readGateText } from '../../../../../hooks/claude/gates/memory/read-gate-text.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const MEMORY_PATH = '/p/.yapus/memory';

test('reads the approved line with the file name and the order with the memory path', () => {
  const sorting = readSorting(MEMORY_PATH);

  assert.ok(sorting.kind === 'text');
  assert.deepEqual(readGateText('x.md', MEMORY_PATH), {
    kind: 'text',
    text: [
      'yapus delegator memory: x.md is new in auto memory, which loads in every session; sort the fact first, and write no MEMORY.md line for it unless line 3 fits.',
      sorting.text,
    ].join('\n'),
  });
});

test('leaves no placeholder of the file or of the memory path in the text', () => {
  const gateText = readGateText('x.md', MEMORY_PATH);

  assert.ok(gateText.kind === 'text');
  assert.doesNotMatch(gateText.text, /<file>|<mem path>/u);
});

test('keeps a dollar sign of the file name as it is', () => {
  const gateText = readGateText('x$&.md', MEMORY_PATH);

  assert.ok(gateText.kind === 'text');
  assert.match(gateText.text, /^yapus delegator memory: x\$&\.md is new in auto memory,/u);
});

test('fails on a text file that is not on disk', (t) => {
  const gateText = readGateText('x.md', MEMORY_PATH, join(makeTempDir(t), 'gone.md'));

  assert.ok(gateText.kind === 'failure');
  assert.match(gateText.detail, /^cannot read .*gone\.md: ENOENT/u);
});
