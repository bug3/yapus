import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readLabelNames,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/labels/read-label-names.ts';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';

function namesOf(...labels: readonly string[]): unknown {
  const word = (text: string) => ({ text, isOpaque: false, canSplit: false });
  const args: GhArguments = {
    values: new Map([['label', labels.map(word)]]),
    flags: new Map(),
    operands: [],
  };

  return readLabelNames(args, 'gh pr create', 'label');
}

test('splits on commas and keeps the spaces', () => {
  assert.deepEqual(namesOf('a: x,b: y'), { names: ['a: x', 'b: y'] });
  assert.deepEqual(namesOf('a: x, b: y'), { names: ['a: x', ' b: y'] });
});

test('reads a double-quoted field as one name', () => {
  assert.deepEqual(namesOf('"a: x",b: y'), { names: ['a: x', 'b: y'] });
  assert.deepEqual(namesOf('"a,b",c'), { names: ['a,b', 'c'] });
  assert.deepEqual(namesOf('"a""b"'), { names: ['a"b'] });
});

test('keeps the values of repeated options apart', () => {
  assert.deepEqual(namesOf('a,b', 'c'), { names: ['a', 'b', 'c'] });
});

test('reads an empty field after a trailing comma', () => {
  assert.deepEqual(namesOf('a,'), { names: ['a', ''] });
});

test('keeps a value that is not well-formed CSV whole', () => {
  assert.deepEqual(namesOf('a"b,c'), { names: ['a"b,c'] });
  assert.deepEqual(namesOf('"a"b,c'), { names: ['"a"b,c'] });
  assert.deepEqual(namesOf('"unclosed,c'), { names: ['"unclosed,c'] });
});
