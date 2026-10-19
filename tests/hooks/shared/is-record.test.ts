import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRecord } from '../../../hooks/shared/is-record.ts';

test('accepts an object', () => {
  assert.equal(isRecord({ a: 1 }), true);
});

test('rejects null', () => {
  const parsedNull: unknown = JSON.parse('null');

  assert.equal(isRecord(parsedNull), false);
});

test('rejects an array', () => {
  assert.equal(isRecord([]), false);
});

test('rejects a string', () => {
  assert.equal(isRecord('text'), false);
});

test('rejects a number', () => {
  assert.equal(isRecord(42), false);
});
