import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  readStartTexts,
} from '../../../../../../hooks/claude/delegator/memory/start/read-start-texts.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

test('reads the nine lines of a file as the texts, in their order', (t) => {
  const path = join(makeTempDir(t), 'start.md');

  writeFileSync(path, 'a\nb\nc\nd\ne\nf\ng\nh\ni\n');

  assert.deepEqual(readStartTexts(path), {
    kind: 'texts',
    texts: {
      directories: 'a',
      signpostsHeader: 'b',
      signpost: 'c',
      upkeep: 'd',
      staleWork: 'e',
      longIndex: 'f',
      missingTarget: 'g',
      tidy: 'h',
      more: 'i',
    },
  });
});

test('fails on a file that is not on disk', (t) => {
  const read = readStartTexts(join(makeTempDir(t), 'gone.md'));

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*gone\.md: ENOENT/u);
});
