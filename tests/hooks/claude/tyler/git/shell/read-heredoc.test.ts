import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readHeredoc } from '../../../../../../hooks/claude/tyler/git/shell/read-heredoc.ts';

const PLAIN = { delimiter: 'EOF', isTabStripped: false };
const STRIPPED = { delimiter: 'EOF', isTabStripped: true };

test('reads lines up to the delimiter line', () => {
  assert.deepEqual(readHeredoc('a\nb\nEOF\nc', 0, PLAIN), { kind: 'body', text: 'a\nb', end: 8 });
});

test('starts reading at the given position', () => {
  assert.deepEqual(readHeredoc('x\na\nEOF', 2, PLAIN), { kind: 'body', text: 'a', end: 7 });
});

test('ends at the end of input after a final delimiter line', () => {
  assert.deepEqual(readHeredoc('EOF', 0, PLAIN), { kind: 'body', text: '', end: 3 });
});

test('does not strip tabs from a plain delimiter line', () => {
  assert.deepEqual(readHeredoc('\tEOF', 0, PLAIN), {
    kind: 'failure',
    reason: 'unterminated heredoc',
  });
});

test('strips tabs from a dash body line', () => {
  assert.deepEqual(readHeredoc('\t\ta\nEOF', 0, STRIPPED), { kind: 'body', text: 'a', end: 7 });
});

test('fails when input ends before the delimiter line', () => {
  assert.deepEqual(readHeredoc('a\n', 0, PLAIN), {
    kind: 'failure',
    reason: 'unterminated heredoc',
  });
});
