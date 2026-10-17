import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCanonicalJson } from './is-canonical-json.ts';

const BOM = String.fromCodePoint(0xfeff);

test('accepts JSON in the D2 form', () => {
  assert.equal(isCanonicalJson('{\n  "a": 1\n}\n'), true);
});

test('rejects a byte order mark', () => {
  assert.equal(isCanonicalJson(`${ BOM }{\n  "a": 1\n}\n`), false);
});

test('rejects a duplicate key', () => {
  assert.equal(isCanonicalJson('{\n  "a": 1,\n  "a": 2\n}\n'), false);
});

test('rejects CRLF line endings', () => {
  assert.equal(isCanonicalJson('{\r\n  "a": 1\r\n}\r\n'), false);
});

test('rejects a missing final newline', () => {
  assert.equal(isCanonicalJson('{\n  "a": 1\n}'), false);
});

test('rejects a comment', () => {
  assert.equal(isCanonicalJson('{\n  // note\n  "a": 1\n}\n'), false);
});

test('rejects a trailing comma', () => {
  assert.equal(isCanonicalJson('{\n  "a": 1,\n}\n'), false);
});

test('rejects a four-space indent', () => {
  assert.equal(isCanonicalJson('{\n    "a": 1\n}\n'), false);
});
