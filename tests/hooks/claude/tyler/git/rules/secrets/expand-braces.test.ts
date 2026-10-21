import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  expandBraces,
} from '../../../../../../../hooks/claude/tyler/git/rules/secrets/expand-braces.ts';

test('expands a comma group', () => {
  assert.deepEqual(expandBraces('.{env,x}'), ['.env', '.x']);
});

test('expands a nested group', () => {
  assert.deepEqual(expandBraces('a{b,{c,d}}'), ['ab', 'ac', 'ad']);
});

test('expands two groups side by side', () => {
  assert.deepEqual(expandBraces('{a,b}{1,2}'), ['a1', 'a2', 'b1', 'b2']);
});

test('keeps a brace without a comma', () => {
  assert.deepEqual(expandBraces('.{env}'), ['.{env}']);
});

test('keeps a brace that never closes', () => {
  assert.deepEqual(expandBraces('a{b,c'), ['a{b,c']);
});

test('keeps a word with no brace', () => {
  assert.deepEqual(expandBraces('.env'), ['.env']);
});
