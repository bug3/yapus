import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFirstLine } from '../../../hooks/shared/get-first-line.ts';

test('takes the first line of an error message', () => {
  assert.equal(getFirstLine(new Error('boom\n    at main')), 'boom');
});

test('takes a thrown string as it is', () => {
  assert.equal(getFirstLine('plain'), 'plain');
});

test('takes an empty message as an empty line', () => {
  assert.equal(getFirstLine(new Error('')), '');
});
