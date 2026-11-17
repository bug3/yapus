import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatLeft,
  formatMove,
  formatMoves,
} from '../../../../../hooks/claude/delegator/upgrade/format-moves.ts';

test('prints a rename as its two paths around an arrow', () => {
  assert.equal(
    formatMove({ kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' }),
    'plans/topic.md -> plans/2026-11/topic/plan.md',
  );
});

test('prints a removal as its path and the word removed', () => {
  assert.equal(formatMove({ kind: 'removal', path: 'prompts' }), 'prompts removed');
});

test('prints one line for each move in the order of the moves', () => {
  assert.equal(
    formatMoves([
      { kind: 'ignore', from: 'prompts/.gitignore', to: 'sessions/.gitignore' },
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'removal', path: 'prompts' },
    ]),
    'prompts/.gitignore -> sessions/.gitignore\n'
    + 'prompts/s1.jsonl -> sessions/2026-11/15T10-00-00Z_s1.jsonl\n'
    + 'prompts removed\n',
  );
});

test('prints nothing to move for no move', () => {
  assert.equal(formatMoves([]), 'nothing to move\n');
});

test('names a left file with its reason', () => {
  assert.equal(
    formatLeft({ path: 'prompts/s1.jsonl', reason: 'no line carries a time' }),
    'prompts/s1.jsonl is left: no line carries a time',
  );
});
