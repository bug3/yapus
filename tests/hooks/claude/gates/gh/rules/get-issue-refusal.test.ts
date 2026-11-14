import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  getIssueRefusal,
} from '../../../../../../hooks/claude/gates/gh/rules/get-issue-refusal.ts';
import {
  CATALOGS_DIRECTORY,
  readGhCatalogs,
} from '../../../../../../hooks/claude/gates/gh/rules/read-gh-catalogs.ts';
import type { Word } from '../../../../../../hooks/claude/gates/gh/shell/split-commands.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

const read = await readGhCatalogs(CATALOGS_DIRECTORY);

if ('violation' in read) {
  throw new Error(read.violation);
}

const CATALOGS = read;

const BUG_BODY = '## Summary\na\n## Steps to reproduce\nb\n## Expected\nc\n## Actual\nd\n'
  + '## Environment\ne\n';
const TITLE = 'hooks: crashes on start';
const LABELS = 'type: fix,scope: hooks';

function words(...texts: readonly string[]): readonly Word[] {
  return texts.map((text) => ({ text, isLiteral: true }));
}

// A directory that holds body.md with the content.
function bodyDir(t: TestContext, content = BUG_BODY): string {
  const dir = makeTempDir(t);

  writeFileSync(join(dir, 'body.md'), content);

  return dir;
}

test('passes a bug issue with a scope title, its labels and the bug headings', (t) => {
  assert.equal(
    getIssueRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), bodyDir(t), CATALOGS),
    undefined,
  );
});

test('passes a feature issue with the feature headings', (t) => {
  assert.equal(
    getIssueRefusal(
      words('-t', 'project: no way to x', '-l', 'type: feat,scope: project', '-F', 'body.md'),
      bodyDir(t, '## Summary\na\n## Why\nb\n'),
      CATALOGS,
    ),
    undefined,
  );
});

test('passes an other issue with the summary heading only', (t) => {
  assert.equal(
    getIssueRefusal(
      words('-t', TITLE, '-l', 'type: docs,scope: hooks', '-F', 'body.md'),
      bodyDir(t, '## Summary\na\n'),
      CATALOGS,
    ),
    undefined,
  );
});

test('refuses a body that does not follow its kind', (t) => {
  assert.equal(
    getIssueRefusal(
      words('-t', TITLE, '-l', 'type: feat,scope: hooks', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the body must have the `##` headings Summary, Why in order, each with text under it; '
    + 'fix the file',
  );
});

test('refuses a title without a catalog scope', (t) => {
  assert.equal(
    getIssueRefusal(
      words('-t', 'nope: crashes', '-l', LABELS, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the title "nope: crashes" of `gh issue create` must be `<scope>: <symptom>`, a scope '
    + 'the catalog scopes.json lists, a symptom, and at most 72 characters; rewrite it',
  );
});

test('refuses a scope label the title does not say', (t) => {
  assert.equal(
    getIssueRefusal(
      words('-t', TITLE, '-l', 'type: fix,scope: tests', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the labels of `gh issue create` must be exactly one `type: <type>` label and '
    + '`scope: hooks`, as its title says, plus any hand-kept extra label and never '
    + '`breaking-change`; fix --label',
  );
});

test('refuses two type labels', (t) => {
  assert.match(
    getIssueRefusal(
      words('-t', TITLE, '-l', `${ LABELS },type: feat`, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ) ?? '',
    /^the labels of `gh issue create` must be exactly one/,
  );
});

test('refuses the breaking-change label', (t) => {
  assert.match(
    getIssueRefusal(
      words('-t', TITLE, '-l', `${ LABELS },breaking-change`, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ) ?? '',
    /^the labels of `gh issue create` must be exactly one/,
  );
});

test('refuses an issue that takes its body from an editor', (t) => {
  assert.equal(
    getIssueRefusal(words('-t', TITLE, '-l', LABELS, '-e'), bodyDir(t), CATALOGS),
    '`gh issue create --editor` takes its text from where this check cannot read it; '
    + 'give --title and --body-file',
  );
});

test('refuses a title over 72 characters', (t) => {
  const title = `hooks: ${ 'x'.repeat(66) }`;

  assert.match(
    getIssueRefusal(words('-t', title, '-l', LABELS, '-F', 'body.md'), bodyDir(t), CATALOGS) ?? '',
    /^the title ".*" of `gh issue create` must be `<scope>: <symptom>`/,
  );
});

test('passes a title of exactly 72 characters', (t) => {
  const title = `hooks: ${ 'x'.repeat(65) }`;

  assert.equal(
    getIssueRefusal(words('-t', title, '-l', LABELS, '-F', 'body.md'), bodyDir(t), CATALOGS),
    undefined,
  );
});

test('refuses an issue with no type label', (t) => {
  assert.equal(
    getIssueRefusal(
      words('-t', TITLE, '-l', 'scope: hooks', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the labels of `gh issue create` must be exactly one `type: <type>` label and '
    + '`scope: hooks`, as its title says, plus any hand-kept extra label and never '
    + '`breaking-change`; fix --label',
  );
});

test('passes --help, which creates nothing', (t) => {
  assert.equal(getIssueRefusal(words('--help'), bodyDir(t), CATALOGS), undefined);
});

test('passes -h, which creates nothing', (t) => {
  assert.equal(getIssueRefusal(words('-h'), bodyDir(t), CATALOGS), undefined);
});

test('passes any title and labels with a Summary in a repository without catalogs', (t) => {
  const dir = bodyDir(t, '## Summary\na\n');

  assert.equal(
    getIssueRefusal(words('-t', 'It crashes', '-l', 'bug', '-F', 'body.md'), dir, undefined),
    undefined,
  );
});

test('refuses a body without a Summary in a repository without catalogs', (t) => {
  assert.match(
    getIssueRefusal(words('-t', 'It crashes', '-F', 'body.md'), bodyDir(t, 'a\n'), undefined)
    ?? '',
    /^the body must have the `##` headings Summary/,
  );
});
