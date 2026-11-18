import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRows } from '../../../../../hooks/claude/delegator/report/read-rows.ts';

const LAUNCH = {
  time: 't1',
  hook: 'launch',
  sessionId: 's',
  subject: 'delegator:builder',
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
  subject: 'delegator:builder',
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
  subject: 'delegator:builder',
  toolUseId: 'toolu_1',
  agentId: 'a1',
  status: 'completed',
  durationMs: 400,
  capped: false,
};

const RESUME = {
  time: 't4',
  hook: 'resume',
  sessionId: 's',
  agentId: 'a1',
  toolUseId: 'toolu_2',
};

function toText(...lines: readonly unknown[]): string {
  return lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n');
}

test('reads a launch, a return and an end row, with absent fields undefined', () => {
  const { rows, skipped } = readRows(`${ toText(LAUNCH, RETURN, END) }\n`);

  assert.equal(skipped, 0);
  assert.deepEqual(rows, [
    { ...LAUNCH, promptId: undefined, model: undefined, callerId: undefined },
    {
      ...RETURN,
      verdict: undefined,
      turns: undefined,
      toolUses: undefined,
      tokens: undefined,
      durationMs: undefined,
      model: undefined,
    },
    {
      ...END,
      promptId: undefined,
      model: undefined,
      outputFile: undefined,
      tokens: undefined,
      toolUses: undefined,
      word: undefined,
      length: undefined,
    },
  ]);
});

test('reads the caller id of a launch row that has one and none from one without', () => {
  const { rows } = readRows(toText({ ...LAUNCH, callerId: 'a0' }, LAUNCH));
  const absent = { promptId: undefined, model: undefined };

  assert.deepEqual(rows, [
    { ...LAUNCH, ...absent, callerId: 'a0' },
    { ...LAUNCH, ...absent, callerId: undefined },
  ]);
});

test('reads the totals of a return row', () => {
  const totals = { turns: 3, toolUses: 2, tokens: 90, durationMs: 1500, model: 'model-a' };

  assert.deepEqual(readRows(toText({ ...RETURN, ...totals })).rows, [
    { ...RETURN, verdict: undefined, ...totals },
  ]);
});

test('reads the output file of an end row', () => {
  const [row] = readRows(toText({ ...END, outputFile: '/tasks/a1.output' })).rows;

  assert.equal(row?.hook === 'end' ? row.outputFile : row, '/tasks/a1.output');
});

test('reads a resume row', () => {
  assert.deepEqual(readRows(toText(RESUME)), { rows: [RESUME], skipped: 0 });
});

test('skips a resume row without an agent id or a call id', () => {
  const text = toText({ ...RESUME, agentId: undefined }, { ...RESUME, toolUseId: 3 });

  assert.deepEqual(readRows(text), { rows: [], skipped: 2 });
});

test('skips a line that is not JSON, not a row and a row of an unknown hook', () => {
  const text = toText('{', '3', { ...LAUNCH, hook: 'other' }, { ...END, capped: 'no' }, END);

  assert.deepEqual(readRows(text).skipped, 4);
  assert.equal(readRows(text).rows.length, 1);
});

test('reads an empty record as no rows', () => {
  assert.deepEqual(readRows(''), { rows: [], skipped: 0 });
});
