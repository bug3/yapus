import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readScanText,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/scan/read-scan-text.ts';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';

type Values = Readonly<Record<string, readonly string[]>>;

function argsOf(values: Values, isOpaque = false): GhArguments {
  const entries = Object.entries(values).map(([name, texts]) => [
    name,
    texts.map((text) => ({ text, isOpaque, canSplit: false })),
  ] as const);

  return { values: new Map(entries), flags: new Map(), operands: [] };
}

test('joins the last value of each named option that is present, one per line', () => {
  const args = argsOf({ title: ['old', 'new'], body: ['text'] });

  assert.deepEqual(readScanText(args, 'gh pr edit', ['title', 'body']), { text: 'new\ntext' });
});

test('skips a named option the call lacks', () => {
  assert.deepEqual(readScanText(argsOf({ title: ['t'] }), 'gh pr edit', ['title', 'body']), {
    text: 't',
  });
});

test('gives empty text when the call has none of the options', () => {
  assert.deepEqual(readScanText(argsOf({}), 'gh pr edit', ['title', 'body-file']), { text: '' });
});

test('refuses a value the shell expands', () => {
  assert.deepEqual(readScanText(argsOf({ title: ['a $B'] }, true), 'gh pr edit', ['title']), {
    refusal: 'the title of `gh pr edit` is not literal; '
      + 'write the title literally, the gate reads it',
  });
});
