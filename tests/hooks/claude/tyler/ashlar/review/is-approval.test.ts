import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isApproval } from '../../../../../../hooks/claude/tyler/ashlar/review/is-approval.ts';

test('accepts DONE then APPROVE', () => {
  assert.equal(isApproval('DONE\nAPPROVE'), true);
});

test('accepts APPROVE followed by nits', () => {
  assert.equal(isApproval('DONE\nAPPROVE with 2 nits'), true);
});

test('rejects REWORK on line 2', () => {
  assert.equal(isApproval('DONE\nREWORK 3'), false);
});

test('rejects a status word other than DONE', () => {
  assert.equal(isApproval('PARTIAL\nAPPROVE'), false);
});

test('rejects a single line', () => {
  assert.equal(isApproval('DONE'), false);
});

test('rejects a word that only starts with APPROVE', () => {
  assert.equal(isApproval('DONE\nAPPROVED'), false);
});
