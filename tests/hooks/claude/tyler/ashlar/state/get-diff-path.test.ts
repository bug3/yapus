import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDiffPath } from '../../../../../../hooks/claude/tyler/ashlar/state/get-diff-path.ts';

test('puts the diff in the scratchpad when there is one', () => {
  assert.equal(getDiffPath('/scratch', '/data', 'session-1'), '/scratch/ashlar-session-1.diff');
});

test('puts the diff under the data directory without a scratchpad', () => {
  assert.equal(getDiffPath(undefined, '/data', 'session-1'), '/data/ashlar/session-1.diff');
});

test('puts the diff under the data directory for an empty scratchpad', () => {
  assert.equal(getDiffPath('', '/data', 'session-1'), '/data/ashlar/session-1.diff');
});
