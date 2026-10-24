import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRefusals } from '../../../../../hooks/claude/providens/report/get-refusals.ts';
import type { LaunchRow, ReturnRow } from '../../../../../hooks/claude/providens/record-row.ts';

const LAUNCH: LaunchRow = {
  time: 't',
  hook: 'launch',
  sessionId: 's',
  subject: 'providens:deacon',
  allowed: false,
  reason: 'a quick task launches no subagent; do it in this session, or raise the depth',
  description: '[quick] x',
  toolUseId: undefined,
  promptId: undefined,
  model: undefined,
  effort: undefined,
};
const RETURN: ReturnRow = {
  time: 't',
  hook: 'return',
  sessionId: 's',
  subject: 'providens:deacon',
  allowed: false,
  reason: '12001 characters',
  agentId: undefined,
  status: 'DONE',
  verdict: undefined,
  length: 12001,
  turns: undefined,
  toolUses: undefined,
  tokens: undefined,
  durationMs: undefined,
  model: undefined,
};

test('counts refused launches by reason and sent-back returns as one reason, most first', () => {
  const refusals = getRefusals([
    RETURN,
    LAUNCH,
    { ...LAUNCH, allowed: true, reason: '' },
    RETURN,
    { ...LAUNCH, reason: 'other' },
  ]);

  assert.deepEqual(refusals, [['return over the cap', 2], [LAUNCH.reason, 1], ['other', 1]]);
});

test('gives no refusals for admitted rows', () => {
  assert.deepEqual(getRefusals([{ ...LAUNCH, allowed: true, reason: '' }]), []);
});
