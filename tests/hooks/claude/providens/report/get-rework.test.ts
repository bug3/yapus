import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRework } from '../../../../../hooks/claude/providens/report/get-rework.ts';
import type { EndRow, ReturnRow } from '../../../../../hooks/claude/providens/record-row.ts';

const END: EndRow = {
  time: '2026-10-24T10:00:00Z',
  hook: 'end',
  sessionId: 's1',
  subject: 'providens:builder',
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
  subject: 'providens:warden',
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

  assert.deepEqual(rework, { builders: 2, reworked: 1 });
});

test('counts a builder once however many returns land on it', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...JUDGE, time: 't2' },
    { ...JUDGE, agentId: 'f', time: 't3', verdict: 'REVISE' },
  ]);

  assert.deepEqual(rework, { builders: 1, reworked: 1 });
});

test('keeps sessions apart and ignores other builders statuses and verdicts', () => {
  const rework = getRework([
    { ...END, time: 't1' },
    { ...END, agentId: 'd', sessionId: 's2', time: 't1' },
    { ...END, agentId: 'e', status: 'async_launched', time: 't2' },
    { ...JUDGE, time: 't4' },
    { ...JUDGE, sessionId: 's2', time: 't5', verdict: 'APPROVE' },
  ]);

  assert.deepEqual(rework, { builders: 2, reworked: 1 });
});

test('counts REVISE and counts nothing for a return before any builder in its session', () => {
  const earlier = { ...JUDGE, time: 't0', verdict: 'REVISE' };

  assert.deepEqual(getRework([{ ...END, time: 't1' }, earlier]), { builders: 1, reworked: 0 });
  assert.deepEqual(
    getRework([{ ...END, time: 't1' }, { ...JUDGE, time: 't2', verdict: 'REVISE' }]),
    { builders: 1, reworked: 1 },
  );
});

test('counts a builder that only returned as reworked by a later REWORK', () => {
  const builderReturn: ReturnRow = {
    ...JUDGE,
    time: '2026-10-24T10:00:00Z',
    subject: 'providens:builder',
    agentId: 'a',
    verdict: undefined,
  };

  assert.deepEqual(getRework([builderReturn, JUDGE]), { builders: 1, reworked: 1 });
});
