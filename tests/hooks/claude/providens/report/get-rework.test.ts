import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRework } from '../../../../../hooks/claude/providens/report/get-rework.ts';
import type {
  EndRow,
  LaunchRow,
  ReturnRow,
} from '../../../../../hooks/claude/providens/record-row.ts';

const END: EndRow = {
  time: '2026-10-24T10:00:00Z',
  hook: 'end',
  sessionId: 's1',
  subject: 'delegator:builder',
  promptId: undefined,
  toolUseId: undefined,
  agentId: 'a',
  status: 'completed',
  model: undefined,
  durationMs: undefined,
  tokens: undefined,
  toolUses: undefined,
  word: undefined,
  length: undefined,
  capped: false,
};
const JUDGE: ReturnRow = {
  time: '2026-10-24T10:05:00Z',
  hook: 'return',
  sessionId: 's1',
  subject: 'delegator:diff-reviewer',
  allowed: true,
  reason: '',
  agentId: 'b',
  status: 'DONE',
  verdict: 'REWORK',
  length: 9,
  turns: undefined,
  toolUses: undefined,
  tokens: undefined,
  durationMs: undefined,
  model: undefined,
};

test('lands one REWORK on the latest builder before it, not on every builder', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...END, agentId: 'c', time: 't3' },
    { ...JUDGE, time: 't4' },
  ]);

  assert.deepEqual(rework, { builders: 2, reworked: 1, finishers: 0, reworkedFinishers: 0 });
});

test('lands each REWORK on the latest builder before it when judges interleave', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...JUDGE, time: 't2' },
    { ...END, agentId: 'c', time: 't3' },
    { ...JUDGE, agentId: 'f', time: 't4' },
  ]);

  assert.deepEqual(rework, { builders: 2, reworked: 2, finishers: 0, reworkedFinishers: 0 });
});

test('lands no REWORK on a builder of another session', () => {
  const rework = getRework([
    { ...END, sessionId: 's2', time: 't1' },
    { ...JUDGE, time: 't2' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 0, finishers: 0, reworkedFinishers: 0 });
});

test('counts a builder once however many returns land on it', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...JUDGE, time: 't2' },
    { ...JUDGE, agentId: 'f', time: 't3', verdict: 'REVISE' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 1, finishers: 0, reworkedFinishers: 0 });
});

test('keeps sessions apart and ignores other builders statuses and verdicts', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...END, agentId: 'd', sessionId: 's2', time: 't1' },
    { ...END, agentId: 'e', status: 'async_launched', time: 't2' },
    { ...JUDGE, time: 't4' },
    { ...JUDGE, sessionId: 's2', time: 't5', verdict: 'APPROVE' },
  ]);

  assert.deepEqual(rework, { builders: 2, reworked: 1, finishers: 0, reworkedFinishers: 0 });
});

test('counts REVISE and counts nothing for a return before any builder in its session', () => {
  const earlier = { ...JUDGE, time: 't0', verdict: 'REVISE' };

  assert.deepEqual(
    getRework([{ ...END, time: 't1' }, earlier]),
    { builders: 1, reworked: 0, finishers: 0, reworkedFinishers: 0 },
  );
  assert.deepEqual(
    getRework([{ ...END, time: 't1' }, { ...JUDGE, time: 't2', verdict: 'REVISE' }]),
    { builders: 1, reworked: 1, finishers: 0, reworkedFinishers: 0 },
  );
});

test('counts a builder that only returned as reworked by a later REWORK', () => {
  const builderReturn: ReturnRow = {
    ...JUDGE,
    time: '2026-10-24T10:00:00Z',
    subject: 'delegator:builder',
    agentId: 'a',
    verdict: undefined,
  };

  assert.deepEqual(
    getRework([builderReturn, JUDGE]),
    { builders: 1, reworked: 1, finishers: 0, reworkedFinishers: 0 },
  );
});

const FINISHER: EndRow = { ...END, subject: 'delegator:finisher', agentId: 'f', time: 't2' };
const NESTED_LAUNCH: LaunchRow = {
  time: 't2',
  hook: 'launch',
  sessionId: 's1',
  subject: 'delegator:diff-reviewer',
  allowed: true,
  reason: '',
  description: 'review the slice',
  toolUseId: 'toolu_b',
  promptId: undefined,
  model: undefined,
  effort: undefined,
  callerId: 'f',
};
const JUDGE_END: EndRow = {
  ...END,
  subject: 'delegator:diff-reviewer',
  agentId: 'b',
  toolUseId: 'toolu_b',
  time: 't3',
};

test('lands a REWORK from a reviewer a finisher launched on it and on no builder', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    NESTED_LAUNCH,
    JUDGE_END,
    { ...JUDGE, time: 't3' },
    { ...FINISHER, time: 't4' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 0, finishers: 1, reworkedFinishers: 1 });
});

test('counts a finisher once however many of its reviewers send it back', () => {
  const rework = getRework([
    NESTED_LAUNCH,
    JUDGE_END,
    { ...JUDGE, time: 't3' },
    { ...NESTED_LAUNCH, toolUseId: 'toolu_g' },
    { ...JUDGE_END, agentId: 'g', toolUseId: 'toolu_g' },
    { ...JUDGE, agentId: 'g', time: 't3', verdict: 'REVISE' },
    { ...FINISHER, time: 't4' },
  ]);

  assert.deepEqual(rework, { builders: 0, reworked: 0, finishers: 1, reworkedFinishers: 1 });
});

test('lands a return without a caller on the builder even after a finisher completed', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    FINISHER,
    { ...NESTED_LAUNCH, callerId: undefined },
    JUDGE_END,
    { ...JUDGE, time: 't3' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 1, finishers: 1, reworkedFinishers: 0 });
});

test('lands a return that reaches no launch row on the builder as before', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    FINISHER,
    { ...NESTED_LAUNCH, toolUseId: undefined },
    { ...JUDGE_END, toolUseId: undefined },
    { ...JUDGE, time: 't3' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 1, finishers: 1, reworkedFinishers: 0 });
});

test('lands a return whose caller matches no completion on nothing', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...NESTED_LAUNCH, callerId: 'x' },
    JUDGE_END,
    { ...JUDGE, time: 't3' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 0, finishers: 0, reworkedFinishers: 0 });
});

test('lands a return whose caller is a builder on nothing', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...NESTED_LAUNCH, callerId: 'a' },
    JUDGE_END,
    { ...JUDGE, time: 't3' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 0, finishers: 0, reworkedFinishers: 0 });
});
