import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function command(...texts: readonly string[]): unknown {
  return {
    kind: 'items',
    items: [
      {
        kind: 'command',
        words: texts.map((text) => ({ text, isOpaque: false })),
        heredocs: [],
      },
    ],
  };
}

test('yields no items for an empty line', () => {
  assert.deepEqual(splitCommands(''), { kind: 'items', items: [] });
});

test('yields no items for a line of only blanks', () => {
  assert.deepEqual(splitCommands(' \t '), { kind: 'items', items: [] });
});

test('splits words on spaces', () => {
  assert.deepEqual(splitCommands('git  status'), command('git', 'status'));
});

test('splits words on tabs', () => {
  assert.deepEqual(splitCommands('git\tstatus'), command('git', 'status'));
});

test('treats an unquoted newline like a space', () => {
  assert.deepEqual(splitCommands('git\nstatus'), command('git', 'status'));
});

test('keeps single-quoted text literal', () => {
  assert.deepEqual(splitCommands("'a b\\n$x\"'"), command('a b\\n$x"'));
});

test('keeps double-quoted spaces in one word', () => {
  assert.deepEqual(splitCommands('"a b"'), command('a b'));
});

test('unescapes a backslash before a double quote, backslash, dollar or backtick', () => {
  assert.deepEqual(splitCommands('"\\"\\\\\\$\\`"'), command('"\\$`'));
});

test('keeps a backslash before any other character inside double quotes', () => {
  assert.deepEqual(splitCommands('"\\n"'), command('\\n'));
});

test('removes a backslash-newline inside double quotes', () => {
  assert.deepEqual(splitCommands('"a\\\nb"'), command('ab'));
});

test('makes a character literal after an unquoted backslash', () => {
  assert.deepEqual(splitCommands('a\\ b \\"\\\\'), command('a b', '"\\'));
});

test('removes an unquoted backslash-newline', () => {
  assert.deepEqual(splitCommands('a\\\nb'), command('ab'));
});

test('yields no word for a backslash-newline between blanks', () => {
  assert.deepEqual(splitCommands('a \\\n b'), command('a', 'b'));
});

test('joins quotes and adjacent text into one word', () => {
  assert.deepEqual(splitCommands('a"b c"\'d\''), command('ab cd'));
});

test('yields a word with empty text for empty quotes', () => {
  assert.deepEqual(splitCommands("'' \"\""), command('', ''));
});

test('fails on an unterminated single quote', () => {
  assert.deepEqual(splitCommands("a 'b"), {
    kind: 'failure',
    reason: 'unterminated single quote',
  });
});

test('fails on an unterminated double quote', () => {
  assert.deepEqual(splitCommands('a "b'), {
    kind: 'failure',
    reason: 'unterminated double quote',
  });
});

test('fails on a trailing lone backslash', () => {
  assert.deepEqual(splitCommands('a\\'), {
    kind: 'failure',
    reason: 'trailing backslash',
  });
});
