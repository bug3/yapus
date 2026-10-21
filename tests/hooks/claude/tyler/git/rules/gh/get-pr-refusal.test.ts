import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getPrRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-pr-refusal.ts';
import { makeTempDir } from '../../../../../../helpers/make-temp-dir.ts';

const BODY = '## Summary\na\n\n## Test plan\nb\n\nBuilt with yapus\n'
  + 'Co-authored-by: yapus <noreply@yapus.dev>\n';
const TITLE = 'feat(hooks): add a check';
const LABELS = 'type: feat,scope: hooks';

function ghCall(...texts: readonly string[]): Call {
  return {
    tool: 'gh',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function bodyFile(t: TestContext, content = BODY): string {
  const path = join(makeTempDir(t), 'body.md');

  writeFileSync(path, content);

  return path;
}

function refusalOf(...texts: readonly string[]): string | undefined {
  return getPrRefusal(ghCall(...texts));
}

test('accepts a draft pull request with a good title and body file', (t) => {
  const file = bodyFile(t);

  assert.equal(refusalOf('pr', 'create', '-d', '-t', TITLE, '-l', LABELS, '-F', file), undefined);
  assert.equal(
    refusalOf('pr', 'new', '--draft', '--title', TITLE, '--label', LABELS, '--body-file', file),
    undefined,
  );
});

test('passes a gh call that is not a pull request create or edit', () => {
  assert.equal(refusalOf('pr', 'list'), undefined);
  assert.equal(refusalOf('pr', 'ready'), undefined);
  assert.equal(refusalOf('pr'), undefined);
  assert.equal(refusalOf('issue', 'create'), undefined);
});

test('passes a git call', () => {
  assert.equal(getPrRefusal({ ...ghCall('pr', 'create'), tool: 'git' }), undefined);
});

test('refuses a create without a title', (t) => {
  assert.equal(
    refusalOf('pr', 'create', '-d', '-F', bodyFile(t)),
    '`gh pr create` needs --title; write it',
  );
});

test('refuses a title out of the subject form', (t) => {
  assert.equal(
    refusalOf('pr', 'create', '-d', '-t', 'Add a check', '-F', bodyFile(t)),
    'the title of `gh pr create` breaks the subject rule: "Add a check" is not in the form '
    + '"type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject; '
    + 'rewrite it',
  );
});

test('refuses a title with an autosquash prefix', (t) => {
  assert.match(
    refusalOf('pr', 'create', '-d', '-t', `fixup! ${ TITLE }`, '-F', bodyFile(t)) ?? '',
    /^the title of `gh pr create` breaks the subject rule/,
  );
});

test('refuses a title that is not literal', (t) => {
  const call = ghCall('pr', 'create', '-d', '-F', bodyFile(t), '-t');
  const title = { text: '$T', isOpaque: true, canSplit: false };

  assert.equal(
    getPrRefusal({ ...call, words: [...call.words, title] }),
    'the title of `gh pr create` is not literal; write the title literally, the gate reads it',
  );
});

test('refuses a create that is not a draft', (t) => {
  const file = bodyFile(t);
  const reason = '`gh pr create` must open a draft; add --draft';

  assert.equal(refusalOf('pr', 'create', '-t', TITLE, '-F', file), reason);
  assert.equal(refusalOf('pr', 'create', '--draft=false', '-t', TITLE, '-F', file), reason);
});

test('refuses each option that takes the text from where the gate cannot read it', (t) => {
  const file = bodyFile(t);
  const base = ['pr', 'create', '-d', '-t', TITLE, '-F', file];

  assert.equal(
    refusalOf(...base, '--body', 'x'),
    '`gh pr create --body` takes its text from where the gate cannot read it; '
    + 'give --title and --body-file with an absolute path',
  );
  assert.match(refusalOf(...base, '--fill') ?? '', /--fill` takes its text/);
  assert.match(refusalOf(...base, '--fill-first') ?? '', /--fill-first` takes its text/);
  assert.match(refusalOf(...base, '--fill-verbose') ?? '', /--fill-verbose` takes its text/);
  assert.match(refusalOf(...base, '-e') ?? '', /--editor` takes its text/);
  assert.match(refusalOf(...base, '--web') ?? '', /--web` takes its text/);
  assert.match(refusalOf(...base, '-T', 'x') ?? '', /--template` takes its text/);
  assert.match(refusalOf(...base, '--recover', 'x') ?? '', /--recover` takes its text/);
});

test('lets a forbidden flag be switched off', (t) => {
  const file = bodyFile(t);

  assert.equal(
    refusalOf('pr', 'create', '-d', '--fill=false', '-t', TITLE, '-l', LABELS, '-F', file),
    undefined,
  );
});

test('refuses a create whose body lacks the footer', (t) => {
  const file = bodyFile(t, '## Summary\na\n## Test plan\nb\n');

  assert.equal(
    refusalOf('pr', 'create', '-d', '-t', TITLE, '-l', LABELS, '-F', file),
    'the body must end with the lines `Built with yapus` and '
    + '`Co-authored-by: yapus <noreply@yapus.dev>`; add them',
  );
});

test('refuses a create whose labels do not say what its title says', (t) => {
  const file = bodyFile(t);

  assert.match(
    refusalOf('pr', 'create', '-d', '-t', TITLE, '-l', 'type: fix', '-F', file) ?? '',
    /^the type, scope and breaking-change labels of `gh pr create`/,
  );
});

test('refuses an edit that removes a label the title says', () => {
  assert.match(
    refusalOf('pr', 'edit', '7', '--remove-label', 'type: feat') ?? '',
    /^`gh pr edit --remove-label` cannot remove/,
  );
});

test('refuses an option the spec does not list', (t) => {
  assert.equal(
    refusalOf('pr', 'create', '-d', '--bogus', '-t', TITLE, '-F', bodyFile(t)),
    '`gh pr create --bogus` is not an option the gate knows; a person runs it',
  );
});

test('judges an edit title and body file when given, and passes an edit with neither', (t) => {
  assert.equal(refusalOf('pr', 'edit', '7', '--add-assignee', '@me'), undefined);
  assert.equal(refusalOf('pr', 'edit', '7', '-t', TITLE, '-F', bodyFile(t)), undefined);
  assert.match(refusalOf('pr', 'edit', '7', '-t', 'bad') ?? '', /^the title of `gh pr edit`/);
  assert.match(refusalOf('pr', 'edit', '7', '-F', bodyFile(t, 'x')) ?? '', /^the body must end/);
});

test('refuses an edit with --body', () => {
  assert.equal(
    refusalOf('pr', 'edit', '7', '--body', 'x'),
    '`gh pr edit --body` takes its text from where the gate cannot read it; '
    + 'give --title and --body-file with an absolute path',
  );
});
