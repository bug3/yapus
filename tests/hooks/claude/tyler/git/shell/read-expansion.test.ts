import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readExpansion } from '../../../../../../hooks/claude/tyler/git/shell/read-expansion.ts';

const CONTEXT = { home: undefined, level: 0 };

test('reads a name to the end of its letters, digits and underscores', () => {
  assert.deepEqual(readExpansion('$a_1-b', 0, CONTEXT), {
    kind: 'substitution',
    items: [],
    end: 4,
  });
});

test('reads one digit of a positional parameter', () => {
  assert.deepEqual(readExpansion('$12', 0, CONTEXT), {
    kind: 'substitution',
    items: [],
    end: 2,
  });
});

test('reads ${...} to its matching brace', () => {
  assert.deepEqual(readExpansion('${a:-${b}} c', 0, CONTEXT), {
    kind: 'substitution',
    items: [],
    end: 10,
  });
});

test('reports none for a dollar before a blank', () => {
  assert.deepEqual(readExpansion('$ a', 0, CONTEXT), { kind: 'none' });
});

test('fails on a ${ with no closing brace', () => {
  assert.deepEqual(readExpansion('${a', 0, CONTEXT), { kind: 'failure', reason: 'unclosed ${' });
});
