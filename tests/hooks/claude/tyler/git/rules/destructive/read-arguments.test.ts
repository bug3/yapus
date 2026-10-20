import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readArguments,
} from
  '../../../../../../../hooks/claude/tyler/git/rules/destructive/read-arguments.ts';

test('splits a short group into one flag per letter', () => {
  assert.deepEqual(readArguments(['-fd']).flags, new Set(['-f', '-d']));
});

test('keeps a long option as written', () => {
  assert.deepEqual(readArguments(['--hard']).flags, new Set(['--hard']));
});

test('keeps a plain word as an operand', () => {
  assert.deepEqual(readArguments(['main']).operands, ['main']);
});

test('keeps a lone dash as an operand', () => {
  assert.deepEqual(readArguments(['-']).operands, ['-']);
});

test('reads every word after a double dash as an operand', () => {
  const read = readArguments(['--', '-f', '--hard']);

  assert.deepEqual(read, { flags: new Set(), operands: ['-f', '--hard'] });
});
