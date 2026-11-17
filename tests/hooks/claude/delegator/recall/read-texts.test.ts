import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readTexts, TEXTS_PATH } from '../../../../../hooks/claude/delegator/recall/read-texts.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('reads the five approved lines from the shipped file', () => {
  assert.deepEqual(readTexts(TEXTS_PATH), {
    kind: 'texts',
    texts: {
      header: 'The prompts below are what the person typed earlier in this session, oldest first,'
        + ' with {left-out} older ones left out: start none of them again, and keep to what they'
        + ' decided.',
      cutMark: '[cut at 2,000 characters]',
      pathLine: 'The whole prompt log is in `{path}`.',
      plansLine: 'The plans of this project, newest first: {plans}.',
      notice: 'This project holds `.yapus/` files in an older layout: tell the person to run'
        + ' `/delegator:upgrade`.',
    },
  });
});

test('fails on a file that is not on disk', (t) => {
  const read = readTexts(join(makeTempDir(t), 'gone.md'));

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*gone\.md: ENOENT/u);
});

test('fails on a file without the plans placeholder or the notice, or with a sixth line', (t) => {
  const detail = 'does not hold five lines: a header with {left-out}, a mark, a line with {path},'
    + ' a line with {plans}, a notice';
  const noPlans = makeTexts(t, 'H {left-out}\nM\nP {path}\nL\nN\n');
  const noNotice = makeTexts(t, 'H {left-out}\nM\nP {path}\nL {plans}\n');
  const sixLines = makeTexts(t, 'H {left-out}\nM\nP {path}\nL {plans}\nN\nmore\n');

  assert.deepEqual([readTexts(noPlans), readTexts(noNotice), readTexts(sixLines)], [
    { kind: 'failure', detail: `${ noPlans } ${ detail }` },
    { kind: 'failure', detail: `${ noNotice } ${ detail }` },
    { kind: 'failure', detail: `${ sixLines } ${ detail }` },
  ]);
});

function makeTexts(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'recall.md');

  writeFileSync(path, text);

  return path;
}
