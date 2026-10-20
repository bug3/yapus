import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readRedirection,
} from '../../../../../../hooks/claude/tyler/git/shell/read-redirection.ts';

const CONTEXT = { home: undefined, level: 0 };

test('reports no redirection for a plain word', () => {
  assert.deepEqual(readRedirection('abc', 0, CONTEXT), { kind: 'none' });
});

test('consumes an attached target', () => {
  assert.deepEqual(readRedirection('>file b', 0, CONTEXT), {
    kind: 'redirection',
    hasTarget: true,
    items: [],
    end: 5,
  });
});

test('leaves a detached target to the caller', () => {
  assert.deepEqual(readRedirection('> file', 0, CONTEXT), {
    kind: 'redirection',
    hasTarget: false,
    items: [],
    end: 1,
  });
});

test('includes a touching digit prefix', () => {
  assert.deepEqual(readRedirection('12>&1', 0, CONTEXT), {
    kind: 'redirection',
    hasTarget: true,
    items: [],
    end: 5,
  });
});

test('reads digits before &> as no redirection', () => {
  assert.deepEqual(readRedirection('2&>f', 0, CONTEXT), { kind: 'none' });
});

test('reads a heredoc delimiter', () => {
  assert.deepEqual(readRedirection('<<EOF', 0, CONTEXT), {
    kind: 'heredoc',
    heredoc: { delimiter: 'EOF', isTabStripped: false, isQuoted: false },
    end: 5,
  });
});

test('reads a dash heredoc delimiter after a blank', () => {
  assert.deepEqual(readRedirection('<<- "E F"', 0, CONTEXT), {
    kind: 'heredoc',
    heredoc: { delimiter: 'E F', isTabStripped: true, isQuoted: true },
    end: 9,
  });
});

test('marks a backslash heredoc delimiter as quoted', () => {
  assert.deepEqual(readRedirection('<<E\\OF', 0, CONTEXT), {
    kind: 'heredoc',
    heredoc: { delimiter: 'EOF', isTabStripped: false, isQuoted: true },
    end: 6,
  });
});

test('fails on an ANSI-C quoted heredoc delimiter', () => {
  assert.deepEqual(readRedirection("<<$'EOF'", 0, CONTEXT), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc delimiter that holds a parameter', () => {
  assert.deepEqual(readRedirection('<<"$X"', 0, CONTEXT), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc without a delimiter', () => {
  assert.deepEqual(readRedirection('<< |', 0, CONTEXT), {
    kind: 'failure',
    reason: 'heredoc without a delimiter',
  });
});
