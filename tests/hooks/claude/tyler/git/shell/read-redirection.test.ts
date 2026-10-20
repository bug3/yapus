import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readRedirection,
} from '../../../../../../hooks/claude/tyler/git/shell/read-redirection.ts';

test('reports no redirection for a plain word', () => {
  assert.deepEqual(readRedirection('abc', 0), { kind: 'none' });
});

test('consumes an attached target', () => {
  assert.deepEqual(readRedirection('>file b', 0), {
    kind: 'redirection',
    hasTarget: true,
    end: 5,
  });
});

test('leaves a detached target to the caller', () => {
  assert.deepEqual(readRedirection('> file', 0), {
    kind: 'redirection',
    hasTarget: false,
    end: 1,
  });
});

test('includes a touching digit prefix', () => {
  assert.deepEqual(readRedirection('12>&1', 0), {
    kind: 'redirection',
    hasTarget: true,
    end: 5,
  });
});

test('reads digits before &> as no redirection', () => {
  assert.deepEqual(readRedirection('2&>f', 0), { kind: 'none' });
});

test('reads a heredoc delimiter', () => {
  assert.deepEqual(readRedirection('<<EOF', 0), {
    kind: 'heredoc',
    heredoc: { delimiter: 'EOF', isTabStripped: false },
    end: 5,
  });
});

test('reads a dash heredoc delimiter after a blank', () => {
  assert.deepEqual(readRedirection('<<- "E F"', 0), {
    kind: 'heredoc',
    heredoc: { delimiter: 'E F', isTabStripped: true },
    end: 9,
  });
});

test('fails on a heredoc without a delimiter', () => {
  assert.deepEqual(readRedirection('<< |', 0), {
    kind: 'failure',
    reason: 'heredoc without a delimiter',
  });
});
