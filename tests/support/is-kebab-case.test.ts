import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isKebabCase } from './is-kebab-case.ts';

test('accepts a kebab-case name', () => {
  assert.equal(isKebabCase('get-dash-lines'), true);
});

test('accepts dot-separated kebab-case segments', () => {
  assert.equal(isKebabCase('get-dash-lines.test'), true);
});

test('rejects a camelCase name', () => {
  assert.equal(isKebabCase('getDashLines'), false);
});

test('rejects a snake_case name', () => {
  assert.equal(isKebabCase('get_dash_lines'), false);
});

test('rejects a name with an upper-case letter', () => {
  assert.equal(isKebabCase('Get-dash'), false);
});

test('rejects a name with a doubled hyphen', () => {
  assert.equal(isKebabCase('get--dash'), false);
});
