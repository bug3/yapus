import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAP_CHARACTERS } from '../../../../hooks/claude/delegator/memory/start/get-context.ts';
import {
  MAX_CHARACTERS,
  POLICY_PATH,
  readPolicy,
} from '../../../../hooks/claude/delegator/policy/get-context.ts';
import { BUDGET_CHARACTERS } from '../../../../hooks/claude/delegator/recall/format-recall.ts';

// Both add context at compact, and Claude Code may cap their sum at 10,000
// characters, so the two together keep a margin under it.
test('keeps the policy and the recall budget together under 9,000 characters', () => {
  const policy = readPolicy(POLICY_PATH);

  assert.ok(policy.kind === 'text');
  assert.ok(policy.text.length + BUDGET_CHARACTERS < 9000);
});

// The memory list is a hook of its own, measured at startup to be capped
// apart from the other two.
test('keeps the cap of the memory list under the cap on one hook\'s context', () => {
  const cap: number = CAP_CHARACTERS;

  assert.ok(cap < MAX_CHARACTERS);
});
