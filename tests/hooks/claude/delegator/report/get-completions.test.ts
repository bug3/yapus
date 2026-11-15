import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getCompletions,
  getSilentEnds,
} from '../../../../../hooks/claude/delegator/report/get-completions.ts';
import type {
  EndRow,
  ResumeRow,
  ReturnRow,
  Row,
} from '../../../../../hooks/claude/delegator/record-row.ts';

const BUILDER = 'delegator:builder';
const END: EndRow = {
  time: 'te',
  hook: 'end',
  sessionId: 's',
  subject: BUILDER,
  promptId: undefined,
  toolUseId: undefined,
  agentId: 'a',
  status: 'completed',
  model: undefined,
  durationMs: 100,
  tokens: 10,
  toolUses: 3,
  word: 'DONE',
  length: 5,
  capped: false,
};
const RETURN: ReturnRow = {
  time: 'tr',
  hook: 'return',
  sessionId: 's',
  subject: BUILDER,
  allowed: true,
  reason: '',
  agentId: 'a',
  status: 'DONE',
  verdict: undefined,
  length: 5,
  turns: 4,
  toolUses: 7,
  tokens: 70,
  durationMs: 700,
  model: undefined,
};
const RESUME: ResumeRow = {
  time: 'tu',
  hook: 'resume',
  sessionId: 's',
  agentId: 'a',
  toolUseId: 'toolu_1',
};
const ASYNC_END: EndRow = { ...END, status: 'async_launched' };

function isCapped(...rows: readonly Row[]): boolean | undefined {
  return getCompletions(rows)[0]?.capped;
}

test('makes a completion of a return alone with the return totals', () => {
  assert.deepEqual(getCompletions([RETURN]), [{
    agentId: 'a',
    subject: BUILDER,
    sessionId: 's',
    time: 'tr',
    durationMs: 700,
    tokens: 70,
    toolUses: 7,
    capped: false,
  }]);
});

test('makes one completion of a completed end and a return with the end totals and time', () => {
  assert.deepEqual(getCompletions([RETURN, { ...END, capped: true }]), [{
    agentId: 'a',
    subject: BUILDER,
    sessionId: 's',
    time: 'te',
    durationMs: 100,
    tokens: 10,
    toolUses: 3,
    capped: true,
  }]);
});

test('makes a completion of a completed end alone', () => {
  const completions = getCompletions([END]);

  assert.deepEqual(completions.map((entry) => [entry.agentId, entry.time]), [['a', 'te']]);
});

test('takes a total the end lacks from the return', () => {
  const [entry] = getCompletions([{ ...END, tokens: undefined }, RETURN]);

  assert.deepEqual([entry?.durationMs, entry?.tokens, entry?.toolUses], [100, 70, 3]);
});

test('takes the source and the totals from the last return of an agent sent back', () => {
  const first = {
    ...RETURN, allowed: false, tokens: 50, durationMs: 100, toolUses: 1, time: 't1',
  };
  const second = {
    ...RETURN, allowed: true, tokens: 70, durationMs: 300, toolUses: 4, time: 't2',
  };
  const completions = getCompletions([first, second]);

  assert.deepEqual(
    completions.map((entry) => [entry.tokens, entry.durationMs, entry.toolUses, entry.time]),
    [[70, 300, 4, 't2']],
  );
});

test('keeps the totals of an earlier return when the last return has none', () => {
  const first = { ...RETURN, tokens: 50, durationMs: 100, toolUses: 1, time: 't1' };
  const last = {
    ...RETURN, tokens: undefined, durationMs: undefined, toolUses: undefined, time: 't2',
  };
  const completions = getCompletions([first, last]);

  assert.deepEqual(
    completions.map((entry) => [entry.tokens, entry.durationMs, entry.toolUses, entry.time]),
    [[50, 100, 1, 't2']],
  );
});

test('counts an async_launched end with a return as no silent end', () => {
  assert.deepEqual(getSilentEnds([{ ...END, status: 'async_launched' }, RETURN]), []);
});

test('counts an async_launched end with a return as one completion', () => {
  const rows = [{ ...END, status: 'async_launched' }, RETURN];

  assert.deepEqual(getCompletions(rows).map((entry) => entry.agentId), ['a']);
});

test('counts an async_launched end without a return as a silent end', () => {
  const end = { ...END, status: 'async_launched' };

  assert.deepEqual(getSilentEnds([end]), [end]);
});

test('counts an async_launched end without a return as no completion', () => {
  assert.deepEqual(getCompletions([{ ...END, status: 'async_launched' }]), []);
});

test('counts a launch as capped when a resume follows an end and no return', () => {
  assert.equal(isCapped(ASYNC_END, RESUME, RETURN), true);
});

test('counts a launch as not capped when a resume follows a return', () => {
  assert.equal(isCapped(ASYNC_END, RETURN, RESUME, RETURN), false);
});

test('counts a foreground launch, whose return precedes its end, as not capped', () => {
  assert.equal(isCapped(RETURN, END, RESUME, RETURN), false);
});

test('counts a launch as capped when a second resume follows a run without a return', () => {
  assert.equal(isCapped(ASYNC_END, RETURN, RESUME, RESUME, RETURN), true);
});

test('counts a launch as capped when a resume follows a refused return only', () => {
  const refused = { ...RETURN, allowed: false };

  assert.equal(isCapped(ASYNC_END, refused, RESUME, RETURN), true);
});

test('counts a resume of another agent id as no cap stop', () => {
  assert.equal(isCapped(ASYNC_END, { ...RESUME, agentId: 'b' }, RETURN), false);
});

test('counts a resumed foreground launch of another agent type as not capped', () => {
  const foreground = { ...END, subject: 'general-purpose' };

  assert.equal(isCapped(foreground, RESUME), false);
});
