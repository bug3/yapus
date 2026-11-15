import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readTexts, TEXTS_PATH } from '../../../../../hooks/claude/providens/recall/read-texts.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('reads the approved header, mark and path line from the shipped file', () => {
  assert.deepEqual(readTexts(TEXTS_PATH), {
    kind: 'texts',
    texts: {
      header: 'The prompts below are what the person typed earlier in this session, oldest first,'
        + ' with {left-out} older ones left out: start none of them again, and keep to what they'
        + ' decided.',
      cutMark: '[cut at 2,000 characters]',
      pathLine: 'The whole prompt log is in `{path}`.',
    },
  });
});

test('fails on a file that is not on disk', (t) => {
  const read = readTexts(join(makeTempDir(t), 'gone.md'));

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*gone\.md: ENOENT/u);
});

test('fails on a file without a placeholder or with a fourth line', (t) => {
  const detail = 'does not hold three lines: a header with {left-out}, a mark, a line with {path}';
  const noPlaceholder = makeTexts(t, 'H\nM\nP {path}\n');
  const fourLines = makeTexts(t, 'H {left-out}\nM\nP {path}\nmore\n');

  assert.deepEqual([readTexts(noPlaceholder), readTexts(fourLines)], [
    { kind: 'failure', detail: `${ noPlaceholder } ${ detail }` },
    { kind: 'failure', detail: `${ fourLines } ${ detail }` },
  ]);
});

function makeTexts(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'recall.md');

  writeFileSync(path, text);

  return path;
}
