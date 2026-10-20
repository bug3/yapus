import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  splitCommands,
  type Word,
} from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function plain(text: string): Word {
  return { text, isOpaque: false };
}

function opaque(text: string): Word {
  return { text, isOpaque: true };
}

function command(...words: readonly Word[]): unknown {
  return { kind: 'items', items: [{ kind: 'command', words, heredocs: [] }] };
}

function failure(reason: string): unknown {
  return { kind: 'failure', reason };
}

test('marks a brace list opaque', () => {
  assert.deepEqual(
    splitCommands('{git,push,--force}', undefined),
    command(opaque('{git,push,--force}')),
  );
});

test('marks a brace list with an empty member opaque', () => {
  assert.deepEqual(
    splitCommands('{gi,}t push', undefined),
    command(opaque('{gi,}t'), plain('push')),
  );
});

test('marks a brace list argument opaque', () => {
  assert.deepEqual(
    splitCommands('git push origin {main,--force}', undefined),
    command(plain('git'), plain('push'), plain('origin'), opaque('{main,--force}')),
  );
});

test('marks a brace sequence opaque', () => {
  assert.deepEqual(splitCommands('{1..3}', undefined), command(opaque('{1..3}')));
});

test('keeps reflog braces plain', () => {
  assert.deepEqual(
    splitCommands('git x HEAD@{1} stash@{0}', undefined),
    command(plain('git'), plain('x'), plain('HEAD@{1}'), plain('stash@{0}')),
  );
});

test('keeps a quoted or escaped brace list plain', () => {
  assert.deepEqual(
    splitCommands("'{a,b}' {a\\,b} \"{1..3}\"", undefined),
    command(plain('{a,b}'), plain('{a,b}'), plain('{1..3}')),
  );
});

test('marks a word with a bracket glob opaque', () => {
  assert.deepEqual(splitCommands('/usr/bin/g[i]t', undefined), command(opaque('/usr/bin/g[i]t')));
});

test('marks a word with a question mark glob opaque', () => {
  assert.deepEqual(splitCommands('/usr/bin/gi?', undefined), command(opaque('/usr/bin/gi?')));
});

test('marks a word with a star glob opaque', () => {
  assert.deepEqual(splitCommands('*.ts', undefined), command(opaque('*.ts')));
});

test('keeps quoted and escaped glob characters plain', () => {
  assert.deepEqual(
    splitCommands("'*' \"?\" \\[", undefined),
    command(plain('*'), plain('?'), plain('[')),
  );
});

test('fails on a zsh glob group inside a word', () => {
  assert.deepEqual(splitCommands('/usr/bin/g(i)t', undefined), failure('zsh glob group'));
});

test('fails on zsh glob qualifiers after a star', () => {
  assert.deepEqual(splitCommands("*(e:'git push':)", undefined), failure('zsh glob group'));
});

test('marks a word that starts with = and a letter opaque', () => {
  assert.deepEqual(splitCommands('=git push', undefined), command(opaque('=git'), plain('push')));
});

test('marks a word that starts with = and a quote opaque', () => {
  assert.deepEqual(
    splitCommands('="git" push', undefined),
    command(opaque('=git'), plain('push')),
  );
});

test('keeps an assignment plain', () => {
  assert.deepEqual(splitCommands('A=b', undefined), command(plain('A=b')));
});
