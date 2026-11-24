import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type AgentStats,
  getAgentStats,
} from '../../../../../hooks/claude/delegator/report/get-agent-stats.ts';
import type {
  EndRow,
  LaunchRow,
  ResumeRow,
  ReturnRow,
} from '../../../../../hooks/claude/delegator/record-row.ts';
import { readShippedWords } from '../read-shipped-words.ts';

const WORDS = readShippedWords();
const BUILDER = 'delegator:builder';
const LAUNCH: LaunchRow = {
  time: 't',
  hook: 'launch',
  sessionId: 's',
  subject: BUILDER,
  allowed: true,
  reason: '',
  description: '[deep] S1',
  toolUseId: undefined,
  promptId: undefined,
  model: undefined,
  effort: undefined,
  callerId: undefined,
};
const END: EndRow = {
  time: 't',
  hook: 'end',
  sessionId: 's',
  subject: BUILDER,
  promptId: undefined,
  toolUseId: undefined,
  agentId: 'a',
  status: 'completed',
  model: undefined,
  outputFile: undefined,
  durationMs: 100,
  tokens: 10,
  toolUses: 3,
  word: 'DONE',
  length: 5,
  capped: false,
};
const RETURN: ReturnRow = {
  time: 't',
  hook: 'return',
  sessionId: 's',
  subject: BUILDER,
  allowed: true,
  reason: '',
  agentId: 'a',
  status: 'DONE',
  verdict: undefined,
  length: 5,
  turns: undefined,
  toolUses: undefined,
  tokens: undefined,
  durationMs: undefined,
  model: undefined,
};

const RESUME: ResumeRow = {
  time: 't',
  hook: 'resume',
  sessionId: 's',
  agentId: 'a',
  toolUseId: 'toolu_1',
};

test('counts launches, ends and returns of one agent type and takes the medians', () => {
  const stats = getAgentStats([
    LAUNCH,
    { ...LAUNCH, allowed: false, reason: 'r' },
    END,
    { ...END, agentId: 'b', capped: true, durationMs: 300, tokens: undefined },
    { ...END, agentId: 'c', status: 'async_launched', durationMs: 9000 },
    { ...RETURN, verdict: 'Command:' },
    { ...RETURN, allowed: false, status: 'Here', verdict: 'REWORK' },
    { ...RETURN, status: 'PARTIAL', verdict: 'REWORK' },
  ], WORDS);

  assert.deepEqual(stats, [{
    agent: BUILDER,
    launches: 1,
    refused: 1,
    completed: 2,
    capped: 1,
    noReturn: 1,
    returns: 3,
    sentBack: 1,
    contractWords: 2,
    verdicts: { REWORK: 2 },
    durationMedianMs: 200,
    tokensMedian: 10,
    toolUsesMedian: 3,
  }]);
});

test('leaves the stats of a completed foreground launch unchanged by a resume row', () => {
  const rows = [LAUNCH, END, RETURN];

  assert.deepEqual(getAgentStats([...rows, RESUME], WORDS), getAgentStats(rows, WORDS));
});

test('ignores a resume of an agent id with no end or return row', () => {
  const rows = [LAUNCH, END, RETURN];

  assert.deepEqual(
    getAgentStats([...rows, { ...RESUME, agentId: 'zzz' }], WORDS),
    getAgentStats(rows, WORDS),
  );
});

test('counts a background launch with a return as completed with the return medians', () => {
  const [stats] = getAgentStats([
    { ...END, status: 'async_launched' },
    { ...RETURN, tokens: 70, toolUses: 7, durationMs: 700 },
  ], WORDS);

  assert.deepEqual(
    [stats?.completed, stats?.capped, stats?.noReturn],
    [1, 0, 0],
  );
  assert.deepEqual(
    [stats?.durationMedianMs, stats?.tokensMedian, stats?.toolUsesMedian],
    [700, 70, 7],
  );
});

test('counts a resume as a cap stop under the agent type of its launch only', () => {
  const diffReviewer = {
    ...END, subject: 'delegator:diff-reviewer', agentId: 'b', status: 'async_launched',
  };
  const [builder, other] = getAgentStats([
    { ...END, status: 'async_launched' },
    RESUME,
    RETURN,
    diffReviewer,
    { ...RETURN, subject: 'delegator:diff-reviewer', agentId: 'b' },
  ], WORDS);

  assert.deepEqual(
    [builder?.agent, builder?.capped, other?.agent, other?.capped],
    [BUILDER, 1, 'delegator:diff-reviewer', 0],
  );
});

test('counts a resume of a launch without a return as no return and not capped', () => {
  const [stats] = getAgentStats([{ ...END, status: 'async_launched' }, RESUME], WORDS);

  assert.deepEqual([stats?.completed, stats?.capped, stats?.noReturn], [0, 0, 1]);
});

test('counts a background launch without a return as no return and not completed', () => {
  const [stats] = getAgentStats([{ ...END, status: 'async_launched' }], WORDS);

  assert.deepEqual([stats?.completed, stats?.noReturn], [0, 1]);
});

test('gives one entry per agent type, sorted by name, with undefined medians without ends', () => {
  const stats = getAgentStats([{ ...LAUNCH, subject: 'delegator:diff-reviewer' }, LAUNCH], WORDS);

  assert.deepEqual(stats.map((entry) => entry.agent), [BUILDER, 'delegator:diff-reviewer']);
  assert.deepEqual(
    [stats[0]?.durationMedianMs, stats[0]?.tokensMedian, stats[0]?.toolUsesMedian],
    [undefined, undefined, undefined],
  );
});

const FINISHER = 'delegator:finisher';
const REVIEWER = 'delegator:diff-reviewer';
const NESTED_LAUNCH: LaunchRow = {
  ...LAUNCH,
  time: 't2',
  subject: REVIEWER,
  toolUseId: 'toolu_r',
  callerId: 'f',
};
const REVIEWER_END: EndRow = {
  ...END,
  time: 't2',
  subject: REVIEWER,
  toolUseId: 'toolu_r',
  agentId: 'r',
  status: 'async_launched',
};
const REVIEWER_RETURN: ReturnRow = { ...RETURN, time: 't4', subject: REVIEWER, agentId: 'r' };
const FINISHER_STOP: ReturnRow = {
  ...RETURN,
  time: 't3',
  subject: FINISHER,
  agentId: 'f',
  allowed: false,
  status: 'PARTIAL',
  verdict: 'REWORK',
};

function getReturnCounts(stats: AgentStats | undefined): unknown[] {
  return [stats?.returns, stats?.sentBack, stats?.contractWords, stats?.verdicts];
}

test('leaves a return while a nested launch runs out of the return counts', () => {
  const [, finisher] = getAgentStats([NESTED_LAUNCH, REVIEWER_END, FINISHER_STOP], WORDS);

  assert.deepEqual(getReturnCounts(finisher), [0, 0, 0, {}]);
});

test('counts a return after the nested subagent returned', () => {
  const [, finisher] = getAgentStats([
    NESTED_LAUNCH,
    REVIEWER_END,
    REVIEWER_RETURN,
    { ...FINISHER_STOP, time: 't5' },
  ], WORDS);

  assert.deepEqual(getReturnCounts(finisher), [1, 1, 1, { REWORK: 1 }]);
});

test('counts every return of a subagent without a nested launch', () => {
  const [, finisher] = getAgentStats([
    NESTED_LAUNCH,
    REVIEWER_END,
    { ...FINISHER_STOP, agentId: 'g' },
  ], WORDS);

  assert.deepEqual(getReturnCounts(finisher), [1, 1, 1, { REWORK: 1 }]);
});

test('counts a return while a nested launch without an end row runs', () => {
  const [, finisher] = getAgentStats([NESTED_LAUNCH, FINISHER_STOP], WORDS);

  assert.deepEqual(getReturnCounts(finisher), [1, 1, 1, { REWORK: 1 }]);
});

test('leaves both waits of two nested launches out and counts the last return', () => {
  const [, finisher] = getAgentStats([
    NESTED_LAUNCH,
    REVIEWER_END,
    FINISHER_STOP,
    REVIEWER_RETURN,
    { ...NESTED_LAUNCH, time: 't5', toolUseId: 'toolu_s' },
    { ...REVIEWER_END, time: 't5', toolUseId: 'toolu_s', agentId: 's' },
    { ...FINISHER_STOP, time: 't6' },
    { ...REVIEWER_RETURN, time: 't7', agentId: 's' },
    { ...RETURN, time: 't8', subject: FINISHER, agentId: 'f' },
  ], WORDS);

  assert.deepEqual(getReturnCounts(finisher), [1, 0, 1, {}]);
});
