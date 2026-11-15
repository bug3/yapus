import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POLICY_PATH, readPolicy } from '../../../../hooks/claude/providens/policy/get-context.ts';
import { BUDGET_CHARACTERS } from '../../../../hooks/claude/providens/recall/format-recall.ts';

// Both add context at compact, and Claude Code may cap their sum at 10,000
// characters, so the two together keep a margin under it.
test('keeps the policy and the recall budget together under 9,000 characters', () => {
  const policy = readPolicy(POLICY_PATH);

  assert.ok(policy.kind === 'text');
  assert.ok(policy.text.length + BUDGET_CHARACTERS < 9000);
});
