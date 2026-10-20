import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readSubstitution,
} from '../../../../../../hooks/claude/tyler/git/shell/read-substitution.ts';

const CONTEXT = { home: undefined, level: 0 };
const DEEP_CONTEXT = { home: undefined, level: 3 };

test('reports none where no substitution starts', () => {
  assert.deepEqual(readSubstitution('ab', 0, CONTEXT), { kind: 'none' });
});

test('reads $( up to just past its closing paren', () => {
  assert.deepEqual(readSubstitution('$(ab) c', 0, CONTEXT), {
    kind: 'substitution',
    items: [
      { kind: 'open' },
      { kind: 'command', words: [{ text: 'ab', isOpaque: false, canSplit: false }], heredocs: [] },
      { kind: 'close' },
    ],
    end: 5,
  });
});

test('reads backticks up to just past the closing one', () => {
  assert.deepEqual(readSubstitution('`ab` c', 0, CONTEXT), {
    kind: 'substitution',
    items: [
      { kind: 'open' },
      { kind: 'command', words: [{ text: 'ab', isOpaque: false, canSplit: false }], heredocs: [] },
      { kind: 'close' },
    ],
    end: 4,
  });
});

test('fails to read a substitution below the depth limit', () => {
  assert.deepEqual(readSubstitution('$(ab)', 0, DEEP_CONTEXT), {
    kind: 'failure',
    reason: 'substitutions nested too deep',
  });
});
