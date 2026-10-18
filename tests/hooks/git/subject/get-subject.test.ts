import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSubject } from '../../../../hooks/git/subject/get-subject.ts';

const SUBJECT = 'feat(hooks): add a check';
const COMMENT_BLOCK = [
  '# Please enter the commit message for your changes. Lines starting',
  "# with '#' will be ignored, and an empty message aborts the commit.",
  '#',
  '# On branch main',
].join('\n');
const SCISSORS_BLOCK = [
  '# ------------------------ >8 ------------------------',
  '# Do not modify or remove the line above.',
  '# Everything below it will be ignored.',
  'diff --git a/a.md b/a.md',
  '+b',
].join('\n');
const EMPTY = 'the message is empty; write a subject line';
const NOT_BLANK = 'the line after the subject is not blank; leave it empty before the body';

test('takes the subject of a message given with -m', () => {
  assert.deepEqual(getSubject(`${ SUBJECT }\n\nThe body.\n`, false), { subject: SUBJECT });
});

test('drops the comment block of an editor message', () => {
  const messageText = `${ SUBJECT }\n\n${ COMMENT_BLOCK }\n`;

  assert.deepEqual(getSubject(messageText, true), { subject: SUBJECT });
});

test('drops everything from the scissors line down in an editor message', () => {
  const messageText = `${ SUBJECT }\n${ COMMENT_BLOCK }\n${ SCISSORS_BLOCK }\n`;

  assert.deepEqual(getSubject(messageText, true), { subject: SUBJECT });
});

test('keeps a # line as content without an editor', () => {
  assert.deepEqual(getSubject('# not a comment\n', false), { subject: '# not a comment' });
});

test('skips leading blank lines', () => {
  assert.deepEqual(getSubject(`\n \t\n${ SUBJECT }\n`, false), { subject: SUBJECT });
});

test('removes trailing whitespace from the subject', () => {
  assert.deepEqual(getSubject(`${ SUBJECT } \t\n`, false), { subject: SUBJECT });
});

test('refuses a second line that is not blank without an editor', () => {
  assert.deepEqual(getSubject(`${ SUBJECT }\nThe body.\n`, false), { violation: NOT_BLANK });
});

test('refuses a second line that is not blank after comments are dropped', () => {
  const messageText = `${ SUBJECT }\n# a comment\nThe body.\n`;

  assert.deepEqual(getSubject(messageText, true), { violation: NOT_BLANK });
});

test('refuses an empty message', () => {
  assert.deepEqual(getSubject('', false), { violation: EMPTY });
});

test('refuses a message that holds only comments and blank lines', () => {
  assert.deepEqual(getSubject(`\n\n${ COMMENT_BLOCK }\n`, true), { violation: EMPTY });
});
