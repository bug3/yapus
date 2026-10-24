import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRows } from '../../../../../hooks/claude/providens/report/read-rows.ts';

const LAUNCH = {
  time: 't1',
  hook: 'launch',
  sessionId: 's',
  subject: 'providens:builder',
  allowed: true,
  reason: '',
  description: '[deep] S1 build it',
  toolUseId: 'toolu_1',
  effort: 'medium',
};
const RETURN = {
  time: 't2',
  hook: 'return',
  sessionId: 's',
  subject: 'providens:builder',
  allowed: true,
  reason: '',
  agentId: 'a1',
  status: 'DONE',
  length: 40,
};
const END = {
  time: 't3',
  hook: 'end',
  sessionId: 's',
  subject: 'providens:builder',
  toolUseId: 'toolu_1',
  agentId: 'a1',
  status: 'completed',
  durationMs: 400,
  capped: false,
};

function toText(...lines: readonly unknown[]): string {
  return lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n');
}

test('reads a launch, a return and an end row, with absent fields undefined', () => {
  const { rows, skipped } = readRows(`${ toText(LAUNCH, RETURN, END) }\n`);

  assert.equal(skipped, 0);
  assert.deepEqual(rows, [
    { ...LAUNCH, promptId: undefined, model: undefined },
    { ...RETURN, verdict: undefined },
    {
      ...END,
      promptId: undefined,
      model: undefined,
      tokens: undefined,
      toolUses: undefined,
      word: undefined,
      length: undefined,
    },
  ]);
});

test('skips a line that is not JSON, not a row and a row of an unknown hook', () => {
  const text = toText('{', '3', { ...LAUNCH, hook: 'other' }, { ...END, capped: 'no' }, END);

  assert.deepEqual(readRows(text).skipped, 4);
  assert.equal(readRows(text).rows.length, 1);
});

test('reads an empty record as no rows', () => {
  assert.deepEqual(readRows(''), { rows: [], skipped: 0 });
});
