import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getMarkdownDashLocations } from './get-markdown-dash-locations.ts';
import { makeTempDir } from './make-temp-dir.ts';

const EN_DASH = String.fromCodePoint(0x2013);
const EM_DASH = String.fromCodePoint(0x2014);

test('finds nothing in markdown with only ASCII hyphens', (t) => {
  const root = makeTempDir(t);

  writeFileSync(join(root, 'a.md'), 'a - b\n');

  assert.deepEqual(getMarkdownDashLocations(root), []);
});

test('names the file and line of each dash in markdown', (t) => {
  const root = makeTreeWithDashes(t);

  assert.deepEqual(getMarkdownDashLocations(root).sort(), ['a.md:2', 'docs/b.MARKDOWN:1']);
});

function makeTreeWithDashes(t: TestContext): string {
  const root = makeTempDir(t);

  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'a.md'), `clean\nb ${ EM_DASH } c\n`);
  writeFileSync(join(root, 'docs', 'b.MARKDOWN'), `5${ EN_DASH }10\n`);
  writeFileSync(join(root, 'code.ts'), `// ${ EM_DASH }\n`);
  writeFileSync(join(root, 'node_modules', 'c.md'), EM_DASH);

  return root;
}
