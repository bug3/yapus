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

test('counts a builder end followed by REWORK or REVISE in its session as reworked', () => {
  const rework = getRework([
    END,
    { ...END, time: '2026-10-24T10:10:00Z' },
    { ...END, sessionId: 's2' },
    { ...END, status: 'async_launched' },
    JUDGE,
    { ...JUDGE, sessionId: 's2', verdict: 'APPROVE' },
  ]);

  assert.deepEqual(rework, { builders: 3, reworked: 1 });
});

test('counts REVISE and ignores a judge before the builder ended', () => {
  const earlier = { ...JUDGE, time: '2026-10-24T09:00:00Z', verdict: 'REVISE' };

  assert.deepEqual(getRework([END, earlier]), { builders: 1, reworked: 0 });
  assert.deepEqual(
    getRework([END, { ...JUDGE, verdict: 'REVISE' }]),
    { builders: 1, reworked: 1 },
  );
});
