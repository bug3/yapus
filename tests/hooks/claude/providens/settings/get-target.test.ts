import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTarget } from '../../../../../hooks/claude/providens/settings/get-target.ts';

test('returns the data dir and the id when both are usable', () => {
  assert.deepEqual(getTarget('/data', 's-1'), { dataDir: '/data', sessionId: 's-1' });
});

test('returns undefined for a missing or empty data dir', () => {
  assert.equal(getTarget(undefined, 's1'), undefined);
  assert.equal(getTarget('', 's1'), undefined);
});

test('returns undefined for a missing or unsafe id', () => {
  assert.equal(getTarget('/data', undefined), undefined);
  assert.equal(getTarget('/data', '../s1'), undefined);
});
