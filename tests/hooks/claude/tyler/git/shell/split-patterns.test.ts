import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import { commandOf, failure, opaque, plain, whole } from './items.ts';

test('marks a brace list opaque', () => {
  assert.deepEqual(
    splitCommands('{git,push,--force}', undefined),
    commandOf(opaque('{git,push,--force}')),
  );
});

test('marks a brace list with an empty member opaque', () => {
  assert.deepEqual(
    splitCommands('{gi,}t push', undefined),
    commandOf(opaque('{gi,}t'), plain('push')),
  );
});

test('marks a brace list argument opaque', () => {
  assert.deepEqual(
    splitCommands('git push origin {main,--force}', undefined),
    commandOf(plain('git'), plain('push'), plain('origin'), opaque('{main,--force}')),
  );
});

test('marks a brace sequence opaque', () => {
  assert.deepEqual(splitCommands('{1..3}', undefined), commandOf(opaque('{1..3}')));
});

test('keeps reflog braces plain', () => {
  assert.deepEqual(
    splitCommands('git x HEAD@{1} stash@{0}', undefined),
    commandOf(plain('git'), plain('x'), plain('HEAD@{1}'), plain('stash@{0}')),
  );
});

test('keeps a quoted or escaped brace list plain', () => {
  assert.deepEqual(
    splitCommands("'{a,b}' {a\\,b} \"{1..3}\"", undefined),
    commandOf(plain('{a,b}'), plain('{a,b}'), plain('{1..3}')),
  );
});

test('marks a word with a bracket glob opaque', () => {
  assert.deepEqual(
    splitCommands('/usr/bin/g[i]t', undefined),
    commandOf(opaque('/usr/bin/g[i]t')),
  );
});

test('marks a word with a question mark glob opaque', () => {
  assert.deepEqual(splitCommands('/usr/bin/gi?', undefined), commandOf(opaque('/usr/bin/gi?')));
});

test('marks a word with a star glob opaque', () => {
  assert.deepEqual(splitCommands('*.ts', undefined), commandOf(opaque('*.ts')));
});

test('keeps quoted and escaped glob characters plain', () => {
  assert.deepEqual(
    splitCommands("'*' \"?\" \\[", undefined),
    commandOf(plain('*'), plain('?'), plain('[')),
  );
});

test('keeps the test command brackets plain', () => {
  assert.deepEqual(
    splitCommands('[ -f x ]', undefined),
    commandOf(plain('['), plain('-f'), plain('x'), plain(']')),
  );
});

test('keeps the double test command brackets plain', () => {
  assert.deepEqual(
    splitCommands('[[ -n x ]]', undefined),
    commandOf(plain('[['), plain('-n'), plain('x'), plain(']]')),
  );
});

test('marks a word that starts with a bracket and more opaque', () => {
  assert.deepEqual(splitCommands('[a', undefined), commandOf(opaque('[a')));
});

test('reads a long word of braces and commas quickly', () => {
  const started = performance.now();

  splitCommands('{,'.repeat(10_000), undefined);

  assert.ok(performance.now() - started < 100);
});

test('fails on a zsh glob group inside a word', () => {
  assert.deepEqual(splitCommands('/usr/bin/g(i)t', undefined), failure('zsh glob group'));
});

test('fails on zsh glob qualifiers after a star', () => {
  assert.deepEqual(splitCommands("*(e:'git push':)", undefined), failure('zsh glob group'));
});

test('marks a word that starts with = and a letter opaque', () => {
  assert.deepEqual(
    splitCommands('=git push', undefined),
    commandOf(whole('=git'), plain('push')),
  );
});

test('marks a word that starts with = and a quote opaque', () => {
  assert.deepEqual(
    splitCommands('="git" push', undefined),
    commandOf(whole('=git'), plain('push')),
  );
});

test('keeps an assignment plain', () => {
  assert.deepEqual(splitCommands('A=b', undefined), commandOf(plain('A=b')));
});
