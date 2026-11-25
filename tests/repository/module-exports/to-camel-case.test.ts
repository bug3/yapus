import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCamelCase } from './to-camel-case.ts';

test('turns a kebab-case name into camelCase', () => {
  assert.equal(toCamelCase('get-dash-lines'), 'getDashLines');
});

test('keeps a one-word name', () => {
  assert.equal(toCamelCase('main'), 'main');
});

test('keeps a digit after a hyphen', () => {
  assert.equal(toCamelCase('parse-2-files'), 'parse2Files');
});

test('turns an underscore between parts like a hyphen', () => {
  assert.equal(toCamelCase('get_dash-lines'), 'getDashLines');
});
