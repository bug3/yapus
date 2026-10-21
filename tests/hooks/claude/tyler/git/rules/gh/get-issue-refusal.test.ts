import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getIssueRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-issue-refusal.ts';
import { makeTempDir } from '../../../../../../helpers/make-temp-dir.ts';

const BUG_BODY = '## Summary\na\n## Steps to reproduce\nb\n## Expected\nc\n## Actual\nd\n'
  + '## Environment\ne\n';
const TITLE = 'hooks: crashes on start';
const LABELS = 'type: fix,scope: hooks';

function ghCall(...texts: readonly string[]): Call {
  return {
    tool: 'gh',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function bodyFile(t: TestContext, content = BUG_BODY): string {
  const path = join(makeTempDir(t), 'body.md');

  writeFileSync(path, content);

  return path;
}

function refusalOf(...texts: readonly string[]): string | undefined {
  return getIssueRefusal(ghCall(...texts));
}

test('accepts an issue with a scope title, its labels and a body file of its kind', (t) => {
  const file = bodyFile(t);

  assert.equal(refusalOf('issue', 'create', '-t', TITLE, '-l', LABELS, '-F', file), undefined);
  assert.equal(
    refusalOf('issue', 'new', '--title', TITLE, '--label', 'scope: hooks', '-l', 'type: fix',
      '--body-file', file),
    undefined,
  );
});

test('accepts a feature issue with the feature headings', (t) => {
  const file = bodyFile(t, '## Summary\na\n## Why\nb\n');

  assert.equal(
    refusalOf('issue', 'create', '-t', 'project: no way to x', '-F', file,
      '-l', 'type: feat,scope: project'),
    undefined,
  );
});

test('accepts an issue of any other type with the summary heading', (t) => {
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-F', bodyFile(t, '## Summary\na\n'),
      '-l', 'type: docs,scope: hooks'),
    undefined,
  );
});

test('passes a gh call that is not an issue create or edit', () => {
  assert.equal(refusalOf('issue', 'list'), undefined);
  assert.equal(refusalOf('pr', 'create'), undefined);
});

test('passes a git call', () => {
  assert.equal(getIssueRefusal({ ...ghCall('issue', 'create'), tool: 'git' }), undefined);
});

test('refuses a create without a title', (t) => {
  assert.equal(
    refusalOf('issue', 'create', '-l', LABELS, '-F', bodyFile(t)),
    '`gh issue create` needs --title; write it',
  );
});

test('refuses a title out of the issue form, with an unknown scope or too long', (t) => {
  const file = bodyFile(t);
  const reason = (title: string): string =>
    `the title ${ JSON.stringify(title) } of \`gh issue create\` must be \`<scope>: <symptom>\`, `
    + 'a scope from hooks/shared/catalogs/scopes.json, a symptom, and at most 72 characters; '
    + 'rewrite it';

  assert.equal(
    refusalOf('issue', 'create', '-t', 'crashes', '-l', LABELS, '-F', file),
    reason('crashes'),
  );
  assert.equal(
    refusalOf('issue', 'create', '-t', 'nope: crashes', '-l', LABELS, '-F', file),
    reason('nope: crashes'),
  );
  assert.equal(
    refusalOf('issue', 'create', '-t', `hooks: ${ 'x'.repeat(66) }`, '-l', LABELS, '-F', file),
    reason(`hooks: ${ 'x'.repeat(66) }`),
  );
});

test('refuses labels that are not one type and the scope of the title', (t) => {
  const file = bodyFile(t);
  const reason = 'the labels of `gh issue create` must be exactly one `type: <type>` label and '
    + '`scope: hooks`, as its title says, plus any hand-kept extra label and never '
    + '`breaking-change`; fix --label';

  assert.equal(refusalOf('issue', 'create', '-t', TITLE, '-F', file), reason);
  assert.equal(refusalOf('issue', 'create', '-t', TITLE, '-l', 'type: fix', '-F', file), reason);
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-l', 'scope: hooks', '-F', file),
    reason,
  );
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-l', 'type: fix,scope: lint', '-F', file),
    reason,
  );
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-l', 'type: fix,type: feat,scope: hooks', '-F',
      file),
    reason,
  );
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-l', 'type: fix,scope: hooks,scope: lint', '-F',
      file),
    reason,
  );
});

test('refuses the breaking-change label on an issue', (t) => {
  assert.match(
    refusalOf('issue', 'create', '-t', TITLE, '-l', 'type: fix,scope: hooks,breaking-change', '-F',
      bodyFile(t)) ?? '',
    /^the labels of `gh issue create` must be exactly one `type: <type>` label/,
  );
});

test('refuses a label outside the catalog', (t) => {
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-l', 'type: fix,scope: hooks,wip', '-F',
      bodyFile(t)),
    '`gh issue create` names the label "wip", which is not in the label catalog; '
    + 'use a label from hooks/shared/catalogs',
  );
});

test('refuses a body file with the headings of another kind', (t) => {
  assert.equal(
    refusalOf('issue', 'create', '-t', TITLE, '-l', LABELS, '-F',
      bodyFile(t, '## Summary\na\n## Why\nb\n')),
    'the body must have the `##` headings Summary, Steps to reproduce, Expected, Actual, '
    + 'Environment in order, each with text under it; fix the file',
  );
});

test('refuses an option that takes the text from where the gate cannot read it', (t) => {
  assert.match(
    refusalOf('issue', 'create', '-t', TITLE, '-l', LABELS, '-F', bodyFile(t), '-b', 'x') ?? '',
    /^`gh issue create --body` takes its text/,
  );
});

test('judges an edit title when given, and passes an edit with none', () => {
  assert.equal(refusalOf('issue', 'edit', '7', '--add-assignee', '@me'), undefined);
  assert.equal(refusalOf('issue', 'edit', '7', '-t', TITLE), undefined);
  assert.match(
    refusalOf('issue', 'edit', '7', '-t', 'bad') ?? '',
    /^the title "bad" of `gh issue edit`/,
  );
});

test('judges the labels an edit adds and removes', () => {
  assert.equal(refusalOf('issue', 'edit', '7', '--add-label', 'type: fix'), undefined);
  assert.match(
    refusalOf('issue', 'edit', '7', '--add-label', 'wip') ?? '',
    /not in the label catalog/,
  );
  assert.match(
    refusalOf('issue', 'edit', '7', '--remove-label', 'scope: hooks') ?? '',
    /^`gh issue edit --remove-label` cannot remove/,
  );
});

test('refuses an edit that adds two types, two scopes or breaking-change', () => {
  const reason = 'the labels `gh issue edit` adds must be at most one `type: <type>` label, at '
    + 'most one `scope:` label equal to the scope of its title, and never `breaking-change`; '
    + 'fix --add-label';

  assert.equal(refusalOf('issue', 'edit', '7', '--add-label', 'type: fix,type: feat'), reason);
  assert.equal(refusalOf('issue', 'edit', '7', '--add-label', 'scope: hooks,scope: lint'), reason);
  assert.equal(refusalOf('issue', 'edit', '7', '--add-label', 'breaking-change'), reason);
  assert.equal(
    refusalOf('issue', 'edit', '7', '-t', TITLE, '--add-label', 'scope: lint'),
    reason,
  );
});

test('judges an edit body file by the kind of the type label it adds', (t) => {
  const summary = bodyFile(t, '## Summary\na\n');

  assert.equal(
    refusalOf('issue', 'edit', '7', '--add-label', 'type: docs', '-F', summary),
    undefined,
  );
  assert.match(
    refusalOf('issue', 'edit', '7', '--add-label', 'type: fix', '-F', summary) ?? '',
    /^the body must have the `##` headings Summary, Steps to reproduce/,
  );
});

test('accepts an edit body file that follows any kind', (t) => {
  assert.equal(refusalOf('issue', 'edit', '7', '-F', bodyFile(t, '## Summary\na\n')), undefined);
  assert.equal(refusalOf('issue', 'edit', '7', '-F', bodyFile(t)), undefined);
  assert.equal(
    refusalOf('issue', 'edit', '7', '-F', bodyFile(t, '## Summary\na\n## Why\nb\n')),
    undefined,
  );
});

test('refuses an edit body file that follows no kind', (t) => {
  assert.equal(
    refusalOf('issue', 'edit', '7', '-F', bodyFile(t, 'text\n')),
    'the body file of `gh issue edit` must follow one issue kind (bug: Summary, Steps to '
    + 'reproduce, Expected, Actual, Environment, feature: Summary, Why, other: Summary); '
    + 'fix the file',
  );
});

test('refuses an edit body file that is not an absolute path', () => {
  assert.match(
    refusalOf('issue', 'edit', '7', '-F', 'b.md') ?? '',
    /^the --body-file of `gh issue edit` is "b.md"/,
  );
});
