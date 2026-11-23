import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  readConsolidateTexts,
  TEXTS_PATH,
} from '../../../../../../hooks/claude/delegator/memory/consolidate/read-consolidate-texts.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

// A created line and a guide of the right form.
const START = 'C <mem path>\nG <moves path> <moves path>\n';
const EXPECTED = 'does not hold four lines: a line with <mem path>, a line with <moves path>'
  + ' twice, a line, a line with <backup>';

test('reads the created line, the guide, the listed line and the done line in that order', (t) => {
  const path = makeTexts(t, `${ START }L\nD <backup>\n`);

  assert.deepEqual(readConsolidateTexts(path), {
    kind: 'texts',
    texts: {
      created: 'C <mem path>',
      guide: 'G <moves path> <moves path>',
      listed: 'L',
      done: 'D <backup>',
    },
  });
});

test('reads four lines from the shipped file', () => {
  assert.equal(readConsolidateTexts(TEXTS_PATH).kind, 'texts');
});

test('fails on a file that is not on disk', (t) => {
  const read = readConsolidateTexts(join(makeTempDir(t), 'gone.md'));

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*gone\.md: ENOENT/u);
});

test('fails on a file with no memory path, one moves path or two backups', (t) => {
  const noMemoryPath = makeTexts(t, 'C\nG <moves path> <moves path>\nL\nD <backup>\n');
  const oneMovesPath = makeTexts(t, 'C <mem path>\nG <moves path>\nL\nD <backup>\n');
  const twoBackups = makeTexts(t, `${ START }L\nD <backup> <backup>\n`);

  assert.deepEqual(
    [
      readConsolidateTexts(noMemoryPath),
      readConsolidateTexts(oneMovesPath),
      readConsolidateTexts(twoBackups),
    ],
    [
      { kind: 'failure', detail: `${ noMemoryPath } ${ EXPECTED }` },
      { kind: 'failure', detail: `${ oneMovesPath } ${ EXPECTED }` },
      { kind: 'failure', detail: `${ twoBackups } ${ EXPECTED }` },
    ],
  );
});

test('fails on a file with an empty listed line or with a fifth line', (t) => {
  const noListed = makeTexts(t, `${ START }\nD <backup>\n`);
  const fiveLines = makeTexts(t, `${ START }L\nD <backup>\nmore\n`);

  assert.deepEqual([readConsolidateTexts(noListed), readConsolidateTexts(fiveLines)], [
    { kind: 'failure', detail: `${ noListed } ${ EXPECTED }` },
    { kind: 'failure', detail: `${ fiveLines } ${ EXPECTED }` },
  ]);
});

function makeTexts(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'consolidate.md');

  writeFileSync(path, text);

  return path;
}
