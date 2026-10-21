import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Word } from '../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import type {
  ActionSpec,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/gh-commands.ts';
import {
  readGhArguments,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';

const SPEC: ActionSpec = {
  command: 'gh pr create',
  source: 'test',
  options: [
    { long: 'title', short: 't', kind: 'value' },
    { long: 'label', short: 'l', kind: 'value' },
    { long: 'draft', short: 'd', kind: 'flag' },
    { long: 'web', short: 'w', kind: 'flag' },
  ],
};

function word(text: string): Word {
  return { text, isOpaque: false, canSplit: false };
}

function read(...texts: readonly string[]): ReturnType<typeof readGhArguments> {
  return readGhArguments(texts.map(word), SPEC);
}

function titled(...titles: readonly string[]): ReturnType<typeof readGhArguments> {
  return { values: new Map([['title', titles.map(word)]]), flags: new Map(), operands: [] };
}

function unknown(shown: string): string {
  return `\`gh pr create ${ shown }\` is not an option the gate knows; a person runs it`;
}

function refused(refusal: string): ReturnType<typeof readGhArguments> {
  return { refusal };
}

test('reads a long option exactly, with its value after or attached', () => {
  assert.deepEqual(read('--title', 'a'), titled('a'));
  assert.deepEqual(read('--title=a=b'), titled('a=b'));
});

test('reads a short option with its value after, attached, or after an equals sign', () => {
  assert.deepEqual(read('-t', 'a'), titled('a'));
  assert.deepEqual(read('-ta'), titled('a'));
  assert.deepEqual(read('-t=a'), titled('a'));
});

test('reads a short group of flags ending with a value letter', () => {
  assert.deepEqual(read('-dt', 'a'), {
    values: new Map([['title', [word('a')]]]),
    flags: new Map([['draft', true]]),
    operands: [],
  });
});

test('keeps every value of a repeated option in order', () => {
  assert.deepEqual(read('-t', 'a', '--title', 'b'), titled('a', 'b'));
});

test('takes the next word as a value even when it starts with a dash', () => {
  assert.deepEqual(read('--title', '-d'), titled('-d'));
});

test('reads a flag as true, or as the boolean written with an equals sign', () => {
  assert.deepEqual(readGhArguments([word('-d')], SPEC), {
    values: new Map(),
    flags: new Map([['draft', true]]),
    operands: [],
  });
  assert.deepEqual(readGhArguments([word('--draft=false')], SPEC), {
    values: new Map(),
    flags: new Map([['draft', false]]),
    operands: [],
  });
  assert.deepEqual(readGhArguments([word('-d=false')], SPEC), {
    values: new Map(),
    flags: new Map([['draft', false]]),
    operands: [],
  });
});

test('keeps the words that are not options as operands, all of them after a double dash', () => {
  assert.deepEqual(readGhArguments(['7', '--', '-t'].map(word), SPEC), {
    values: new Map(),
    flags: new Map(),
    operands: [word('7'), word('-t')],
  });
});

test('refuses an option cut to a prefix, which pflag does not accept', () => {
  assert.deepEqual(read('--tit', 'a'), refused(unknown('--tit')));
});

test('refuses an unknown option, long or short', () => {
  assert.deepEqual(read('--x'), refused(unknown('--x')));
  assert.deepEqual(read('-dx'), refused(unknown('-x')));
});

test('refuses a value option without a value', () => {
  assert.deepEqual(read('--title'), refused(
    '`gh pr create --title` has no value; write the value after the option',
  ));
});

test('refuses a short option written with an equals sign and nothing after it', () => {
  assert.deepEqual(read('-t='), refused(
    '`gh pr create -t=` ends in an equals sign with no value after it; '
    + 'write the value after a space',
  ));
});

test('refuses a flag given a value other than true or false', () => {
  assert.deepEqual(read('--draft=yes'), refused(
    '`gh pr create --draft` takes only true or false; write `--draft=true` or `--draft=false`',
  ));
});

test('refuses a word the gate cannot read', () => {
  const unreadable = { text: '$X', isOpaque: true, canSplit: true };

  assert.deepEqual(readGhArguments([word('-t'), unreadable], SPEC), refused(
    'cannot judge `gh pr create` with an argument the gate cannot read; '
    + 'quote it if it is one word, and start it with neither - nor +',
  ));
});

test('refuses a quoted word that starts with an expansion', () => {
  const reason = 'cannot judge `gh pr create` with an argument the gate cannot read; '
    + 'quote it if it is one word, and start it with neither - nor +';

  assert.deepEqual(
    readGhArguments([word('-t'), { text: '$F', isOpaque: true, canSplit: false }], SPEC),
    refused(reason),
  );
  assert.deepEqual(
    readGhArguments([word('-t'), { text: '`pwd`', isOpaque: true, canSplit: false }], SPEC),
    refused(reason),
  );
});

test('reads a quoted word that only holds an expansion later', () => {
  const value = { text: 'a-$F', isOpaque: true, canSplit: false };

  assert.ok('values' in readGhArguments([word('-t'), value], SPEC));
});
