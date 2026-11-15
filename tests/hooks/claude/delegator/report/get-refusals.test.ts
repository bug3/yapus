import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRefusals } from '../../../../../hooks/claude/delegator/report/get-refusals.ts';
import type {
  LaunchRow,
  ResumeRow,
  ReturnRow,
} from '../../../../../hooks/claude/delegator/record-row.ts';

const LAUNCH: LaunchRow = {
  time: 't',
  hook: 'launch',
  sessionId: 's',
  subject: 'delegator:reader',
  allowed: false,
  reason: 'a quick task launches no subagent; do it in this session, or raise the depth',
  description: '[quick] x',
  toolUseId: undefined,
  promptId: undefined,
  model: undefined,
  effort: undefined,
  callerId: undefined,
};
const RETURN: ReturnRow = {
  time: 't',
  hook: 'return',
  sessionId: 's',
  subject: 'delegator:reader',
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

test('counts a resume row as no refusal', () => {
  const resume: ResumeRow = {
    time: 't', hook: 'resume', sessionId: 's', agentId: 'a', toolUseId: 'toolu_1',
  };

  assert.deepEqual(getRefusals([resume]), []);
});

test('gives no refusals for admitted rows', () => {
  assert.deepEqual(getRefusals([{ ...LAUNCH, allowed: true, reason: '' }]), []);
});
