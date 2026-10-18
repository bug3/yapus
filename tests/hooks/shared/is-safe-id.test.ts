import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSafeId } from '../../../hooks/shared/is-safe-id.ts';

test('accepts letters, digits and hyphens', () => {
  assert.equal(isSafeId('Abc-123-xyz'), true);
});

test('accepts 128 characters', () => {
  assert.equal(isSafeId('a'.repeat(128)), true);
});

test('rejects a non-string', () => {
  assert.equal(isSafeId(42), false);
});

test('rejects the empty string', () => {
  assert.equal(isSafeId(''), false);
});

test('rejects 129 characters', () => {
  assert.equal(isSafeId('a'.repeat(129)), false);
});

test('rejects a path traversal', () => {
  assert.equal(isSafeId('../x'), false);
});

test('rejects a slash', () => {
  assert.equal(isSafeId('a/b'), false);
});

test('rejects a dot', () => {
  assert.equal(isSafeId('a.b'), false);
});
