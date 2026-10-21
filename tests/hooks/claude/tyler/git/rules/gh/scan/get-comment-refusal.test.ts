import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import type { Call } from '../../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getCommentRefusal,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/scan/get-comment-refusal.ts';
import type {
  Word,
} from '../../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import { makeTempDir } from '../../../../../../../helpers/make-temp-dir.ts';

function word(text: string, isOpaque = false): Word {
  return { text, isOpaque, canSplit: false };
}

function callOf(tool: 'git' | 'gh', words: readonly Word[]): Call {
  return { tool, words, configs: [], assignments: [] };
}

function refusalOf(...texts: readonly string[]): string | undefined {
  return getCommentRefusal(callOf('gh', texts.map((text) => word(text))));
}

function fileIn(t: TestContext, content: string): string {
  const path = join(makeTempDir(t), 'body.md');

  writeFileSync(path, content);

  return path;
}

test('passes a comment and a review with a literal body', () => {
  assert.equal(refusalOf('pr', 'comment', '13', '--body', 'Hi'), undefined);
  assert.equal(refusalOf('issue', 'comment', '12', '-b', 'Hi', '-R', 'o/r'), undefined);
  assert.equal(refusalOf('pr', 'review', '123', '-r', '-b', 'needs work'), undefined);
});

test('passes a comment that deletes the last one and gives no text', () => {
  assert.equal(refusalOf('pr', 'comment', '13', '--delete-last', '--yes'), undefined);
});

test('passes a comment and a review with a body file at an absolute path', (t) => {
  const path = fileIn(t, 'text\n');

  assert.equal(refusalOf('pr', 'comment', '13', '--body-file', path), undefined);
  assert.equal(refusalOf('pr', 'review', '--approve', '-F', path), undefined);
});

test('refuses an editor on a comment', () => {
  assert.equal(
    refusalOf('pr', 'comment', '13', '--editor'),
    '`gh pr comment --editor` takes its text from where the gate cannot read it; '
    + 'give --body or --body-file with an absolute path',
  );
  assert.match(refusalOf('issue', 'comment', '12', '-e') ?? '', /^`gh issue comment --editor`/u);
});

test('refuses the web on a comment', () => {
  assert.equal(
    refusalOf('issue', 'comment', '12', '--web'),
    '`gh issue comment --web` takes its text from where the gate cannot read it; '
    + 'give --body or --body-file with an absolute path',
  );
});

test('refuses standard input and a relative path as the body file', () => {
  assert.equal(
    refusalOf('pr', 'comment', '13', '--body-file', '-'),
    'the --body-file of `gh pr comment` is "-"; '
    + 'write an absolute path to a file, not - or a relative path',
  );
  assert.equal(
    refusalOf('pr', 'review', '-F', 'b.md'),
    'the --body-file of `gh pr review` is "b.md"; '
    + 'write an absolute path to a file, not - or a relative path',
  );
});

test('refuses a body file that is missing', (t) => {
  const path = join(makeTempDir(t), 'none.md');

  assert.equal(
    refusalOf('issue', 'comment', '12', '-F', path),
    `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a body file over 64 KiB', (t) => {
  const path = fileIn(t, 'a'.repeat(65_537));

  assert.equal(
    refusalOf('pr', 'comment', '13', '-F', path),
    `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a body that the shell expands', () => {
  const body = word('see $TEXT', true);
  const call = callOf('gh', [word('pr'), word('comment'), word('--body'), body]);

  assert.equal(
    getCommentRefusal(call),
    'the body of `gh pr comment` is not literal; write the body literally, the gate reads it',
  );
});

test('refuses an option the action does not have', () => {
  assert.equal(
    refusalOf('pr', 'review', '--attach', 'a.png'),
    '`gh pr review --attach` is not an option the gate knows; a person runs it',
  );
});

test('judges neither another action nor git', () => {
  assert.equal(refusalOf('pr', 'view', '13', '--web'), undefined);
  const gitCall = callOf('git', [word('pr'), word('comment'), word('-e')]);

  assert.equal(getCommentRefusal(gitCall), undefined);
});
