import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getPrRefusal } from '../../../../../../hooks/claude/gates/gh/rules/get-pr-refusal.ts';
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

const BODY = '## Summary\na\n\n## Test plan\nb\n\nBuilt with [yapus](https://yapus.dev)\n';
const TITLE = 'feat(hooks): add a check';
const LABELS = 'type: feat,scope: hooks';

function words(...texts: readonly string[]): readonly Word[] {
  return texts.map((text) => ({ text, isLiteral: true }));
}

// A directory that holds body.md with the content.
function bodyDir(t: TestContext, content = BODY): string {
  const dir = makeTempDir(t);

  writeFileSync(join(dir, 'body.md'), content);

  return dir;
}

test('passes a create with a good title, labels and body file, without --draft', (t) => {
  const dir = bodyDir(t);

  assert.equal(
    getPrRefusal(
      words('-t', TITLE, '-l', LABELS, '-F', join(dir, 'body.md')),
      undefined,
      CATALOGS,
    ),
    undefined,
  );
});

test('passes the long, equals and attached option forms', (t) => {
  const dir = bodyDir(t);

  assert.equal(
    getPrRefusal(
      words(`--title=${ TITLE }`, `-l${ LABELS }`, `-F=${ join(dir, 'body.md') }`, '-B', 'main'),
      undefined,
      CATALOGS,
    ),
    undefined,
  );
});

test('refuses a title out of the subject form', (t) => {
  assert.equal(
    getPrRefusal(words('-t', 'Add a check', '-l', LABELS, '-F', 'body.md'), bodyDir(t), CATALOGS),
    'the title of `gh pr create` breaks the subject rule: "Add a check" is not in the form '
    + '"type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject; '
    + 'rewrite it',
  );
});

test('refuses a create without a title', (t) => {
  assert.equal(
    getPrRefusal(words('-l', LABELS, '-F', 'body.md'), bodyDir(t), CATALOGS),
    '`gh pr create` needs --title; write it',
  );
});

test('refuses a title that is not literal', (t) => {
  assert.equal(
    getPrRefusal(
      [...words('-t'), { text: '$T', isLiteral: false }, ...words('-F', 'body.md')],
      bodyDir(t),
      CATALOGS,
    ),
    'the title of `gh pr create` is not literal; write the title literally, this check reads it',
  );
});

test('refuses a word that starts with an expansion where an option could be', (t) => {
  assert.equal(
    getPrRefusal(
      [...words('-t', TITLE), { text: '$OPTS', isLiteral: false }],
      bodyDir(t),
      CATALOGS,
    ),
    '`gh pr create` has an argument that starts with an expansion, which could be any option; '
    + 'write it literally',
  );
});

test('refuses --body, which takes the text from elsewhere', (t) => {
  assert.equal(
    getPrRefusal(words('-t', TITLE, '-b', 'x'), bodyDir(t), CATALOGS),
    '`gh pr create --body` takes its text from where this check cannot read it; '
    + 'give --title and --body-file',
  );
});

test('refuses --editor', (t) => {
  assert.match(getPrRefusal(words('-t', TITLE, '-e'), bodyDir(t), CATALOGS) ?? '', /--editor` takes/);
});

test('refuses --web', (t) => {
  assert.match(getPrRefusal(words('-t', TITLE, '--web'), bodyDir(t), CATALOGS) ?? '', /--web` takes/);
});

test('refuses --fill', (t) => {
  assert.match(getPrRefusal(words('-t', TITLE, '-f'), bodyDir(t), CATALOGS) ?? '', /--fill` takes/);
});

test('refuses --fill-first', (t) => {
  assert.match(
    getPrRefusal(words('-t', TITLE, '--fill-first'), bodyDir(t), CATALOGS) ?? '',
    /--fill-first` takes/,
  );
});

test('refuses --fill-verbose', (t) => {
  assert.match(getPrRefusal(words('--fill-verbose'), bodyDir(t), CATALOGS) ?? '', /--fill-verbose` takes/);
});

test('refuses --template', (t) => {
  assert.match(getPrRefusal(words('-T', 'x'), bodyDir(t), CATALOGS) ?? '', /--template` takes/);
});

test('refuses --recover', (t) => {
  assert.match(getPrRefusal(words('--recover', 'x'), bodyDir(t), CATALOGS) ?? '', /--recover` takes/);
});

test('refuses a create without labels', (t) => {
  assert.equal(
    getPrRefusal(words('-t', TITLE, '-F', 'body.md'), bodyDir(t), CATALOGS),
    'the type, scope and breaking-change labels of `gh pr create` must be exactly '
    + '`type: feat`, `scope: hooks`, as its title says, besides any hand-kept extra label; '
    + 'fix --label',
  );
});

test('refuses a scope label the title does not say', (t) => {
  assert.match(
    getPrRefusal(
      words('-t', TITLE, '-l', 'type: feat,scope: tests', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ) ?? '',
    /^the type, scope and breaking-change labels of `gh pr create` must be exactly/,
  );
});

test('refuses a label outside the catalog', (t) => {
  assert.equal(
    getPrRefusal(
      words('-t', TITLE, '-l', `${ LABELS },nope`, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    '`gh pr create` names the label "nope", which is not in the label catalog; '
    + 'use a label the catalog labels.json lists',
  );
});

test('passes a hand-kept extra label', (t) => {
  assert.equal(
    getPrRefusal(
      words('-t', TITLE, '-l', LABELS, '-l', 'help wanted', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    undefined,
  );
});

test('refuses a body without the headings in order', (t) => {
  const dir = bodyDir(t, '## Test plan\nb\n\n## Summary\na\n\nBuilt with [yapus](https://yapus.dev)\n');

  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), dir, CATALOGS),
    'the body must have the `##` headings Summary, Test plan in order, each with text under it; '
    + 'fix the file',
  );
});

test('refuses a body without the footer', (t) => {
  const dir = bodyDir(t, '## Summary\na\n\n## Test plan\nb\n');

  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), dir, CATALOGS),
    'the body must end with the lines `Built with [yapus](https://yapus.dev)`; add them',
  );
});

test('refuses a body file that does not exist yet', (t) => {
  const dir = makeTempDir(t);

  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), dir, CATALOGS),
    `${ join(dir, 'body.md') } does not exist yet; write the file first, then run the command`,
  );
});

test('refuses a body file that is not UTF-8', (t) => {
  const dir = makeTempDir(t);

  writeFileSync(join(dir, 'body.md'), Buffer.from([0xff, 0xfe]));

  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), dir, CATALOGS),
    `cannot read ${ join(dir, 'body.md') }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('reads a relative body file against a known directory', (t) => {
  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), bodyDir(t), CATALOGS),
    undefined,
  );
});

test('refuses a relative body file when the directory is unknown', () => {
  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), undefined, CATALOGS),
    'the --body-file "body.md" of `gh pr create` is relative to a directory this check cannot '
    + 'tell; give an absolute --body-file',
  );
});

test('refuses a body file read from standard input', (t) => {
  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', '-'), bodyDir(t), CATALOGS),
    'the --body-file of `gh pr create` is standard input, which this check cannot read; '
    + 'write the body to a file and give its path',
  );
});

test('refuses a create without a body file', (t) => {
  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS), bodyDir(t), CATALOGS),
    '`gh pr create` needs --body-file; write it',
  );
});

test('refuses a body file over 64 KiB', (t) => {
  const dir = bodyDir(t, `${ BODY }${ 'a'.repeat(65_536) }`);

  assert.equal(
    getPrRefusal(words('-t', TITLE, '-l', LABELS, '-F', 'body.md'), dir, CATALOGS),
    `cannot read ${ join(dir, 'body.md') }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a label list with a line break', (t) => {
  assert.match(
    getPrRefusal(
      words('-t', TITLE, '-l', 'type: feat\nscope: hooks', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ) ?? '',
    /^the --label of `gh pr create` is not a label list/,
  );
});

test('refuses a label list with unpaired quotes', (t) => {
  assert.match(
    getPrRefusal(
      words('-t', TITLE, '-l', '"type: feat', '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ) ?? '',
    /^the --label of `gh pr create` is not a label list/,
  );
});

test('refuses a breaking title without the breaking-change label', (t) => {
  assert.equal(
    getPrRefusal(
      words('-t', 'feat(hooks)!: add x', '-l', LABELS, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the type, scope and breaking-change labels of `gh pr create` must be exactly '
    + '`type: feat`, `scope: hooks`, `breaking-change`, as its title says, besides any '
    + 'hand-kept extra label; fix --label',
  );
});

test('passes a breaking title with the breaking-change label', (t) => {
  assert.equal(
    getPrRefusal(
      words('-t', 'feat(hooks)!: add x', '-l', `${ LABELS },breaking-change`, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    undefined,
  );
});

test('refuses a title with an autosquash prefix', (t) => {
  assert.equal(
    getPrRefusal(
      words('-t', 'fixup! feat(hooks): add x', '-l', LABELS, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the title of `gh pr create` breaks the subject rule: "fixup! feat(hooks): add x" is not in '
    + 'the form "type(scope): verb ...", such as "feat(hooks): add a check"; '
    + 'rewrite the subject; rewrite it',
  );
});

test('refuses a title that git writes for a merge', (t) => {
  assert.equal(
    getPrRefusal(
      words('-t', "Merge branch 'x'", '-l', LABELS, '-F', 'body.md'),
      bodyDir(t),
      CATALOGS,
    ),
    'the title of `gh pr create` breaks the subject rule: "Merge branch \'x\'" is not in '
    + 'the form "type(scope): verb ...", such as "feat(hooks): add a check"; '
    + 'rewrite the subject; rewrite it',
  );
});

test('refuses an option it does not know', (t) => {
  assert.equal(
    getPrRefusal(words('--nope'), bodyDir(t), CATALOGS),
    '`gh pr create --nope` is not an option this check knows; remove it, or a person runs '
    + 'the command',
  );
});

test('refuses an option that lacks its value', (t) => {
  assert.equal(
    getPrRefusal(words('-t'), bodyDir(t), CATALOGS),
    '`gh pr create -t` has no value; write the value after the option',
  );
});

test('refuses a flag given a value other than true or false', (t) => {
  assert.equal(
    getPrRefusal(words('--draft=maybe'), bodyDir(t), CATALOGS),
    '`gh pr create --draft` takes only true or false; write `--draft=true` or `--draft=false`',
  );
});

test('refuses a short option ending in an equals sign', (t) => {
  assert.equal(
    getPrRefusal(words('-t='), bodyDir(t), CATALOGS),
    '`gh pr create -t=` ends in an equals sign with no value after it; '
    + 'write the value after a space',
  );
});

test('passes --help, which creates nothing', (t) => {
  assert.equal(getPrRefusal(words('--help'), bodyDir(t), CATALOGS), undefined);
});

test('passes -h, which creates nothing', (t) => {
  assert.equal(getPrRefusal(words('-h'), bodyDir(t), CATALOGS), undefined);
});

test('passes any title and label with a headed body in a repository without catalogs', (t) => {
  const dir = bodyDir(t, '## Summary\na\n\n## Test plan\nb\n');

  assert.equal(
    getPrRefusal(words('-t', 'Add a check', '-l', 'bug', '-F', 'body.md'), dir, undefined),
    undefined,
  );
});

test('refuses a missing title in a repository without catalogs', (t) => {
  assert.match(
    getPrRefusal(words('-F', 'body.md'), bodyDir(t), undefined) ?? '',
    /--title/,
  );
});

test('refuses a body without the headings in a repository without catalogs', (t) => {
  assert.match(
    getPrRefusal(words('-t', 'Add a check', '-F', 'body.md'), bodyDir(t, 'a\n'), undefined) ?? '',
    /^the body must have the `##` headings Summary, Test plan/,
  );
});

test('refuses -h taken as the value of --title', (t) => {
  assert.match(getPrRefusal(words('-t', '-h'), bodyDir(t), CATALOGS) ?? '', /^the title of `gh pr create`/);
});
