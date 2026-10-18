import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCodePointName } from '../../../hooks/shared/get-code-point-name.ts';

test('names a code point in uppercase hex with at least four digits', () => {
  assert.equal(getCodePointName(0x2d), 'U+002D');
});

test('names a code point past four digits in full', () => {
  assert.equal(getCodePointName(0x10d6e), 'U+10D6E');
});
