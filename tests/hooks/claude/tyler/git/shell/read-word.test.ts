import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isWordBoundary,
  readWord,
} from '../../../../../../hooks/claude/tyler/git/shell/read-word.ts';

test('stops a word at an operator character', () => {
  assert.deepEqual(readWord('ab;c', 0), {
    kind: 'word',
    text: 'ab',
    isPresent: true,
    isPlain: true,
    tilde: 'none',
    end: 2,
  });
});

test('marks a word with a quote as not plain', () => {
  assert.deepEqual(readWord("'{'", 0), {
    kind: 'word',
    text: '{',
    isPresent: true,
    isPlain: false,
    tilde: 'none',
    end: 3,
  });
});

test('classifies a leading tilde before a slash as home', () => {
  assert.deepEqual(readWord('~/x', 0), {
    kind: 'word',
    text: '~/x',
    isPresent: true,
    isPlain: true,
    tilde: 'home',
    end: 3,
  });
});

test('classifies a leading tilde before a name as user', () => {
  assert.deepEqual(readWord('~bob', 0), {
    kind: 'word',
    text: '~bob',
    isPresent: true,
    isPlain: true,
    tilde: 'user',
    end: 4,
  });
});

test('counts the end of input as a word boundary', () => {
  assert.equal(isWordBoundary(''), true);
});

test('does not count a letter as a word boundary', () => {
  assert.equal(isWordBoundary('a'), false);
});
