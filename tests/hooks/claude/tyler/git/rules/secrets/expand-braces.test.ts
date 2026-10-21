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

test('cannot tell what a number sequence makes', () => {
  assert.equal(expandBraces('x{1..3}'), undefined);
  assert.equal(expandBraces('x{1..9..2}'), undefined);
});

test('cannot tell what a letter sequence makes', () => {
  assert.equal(expandBraces('x.{a..e}'), undefined);
});

test('cannot tell what a sequence inside a comma group makes', () => {
  assert.equal(expandBraces('x{a,{1..3}}'), undefined);
});

test('cannot tell what a group past the word cap makes', () => {
  assert.equal(expandBraces('{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}'), undefined);
});

test('expands a group at the word cap', () => {
  assert.equal(expandBraces('{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}')?.length, 256);
});

test('cannot tell what a word past the group cap makes', () => {
  assert.equal(
    expandBraces('{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}{a}'),
    undefined,
  );
});

test('cannot tell what a word past the length cap makes', () => {
  assert.equal(expandBraces('a'.repeat(1025)), undefined);
});

test('reads a parameter expansion as plain text', () => {
  assert.deepEqual(expandBraces('${X}.env'), ['${X}.env']);
});
