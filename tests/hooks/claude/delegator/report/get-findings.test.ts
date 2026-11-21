import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type AgentStats,
  getAgentStats,
} from '../../../../../hooks/claude/delegator/report/get-agent-stats.ts';
import type { EndRow, ResumeRow } from '../../../../../hooks/claude/delegator/record-row.ts';
import { getFindings } from '../../../../../hooks/claude/delegator/report/get-findings.ts';

const SILENT_END: EndRow = {
  time: 't',
  hook: 'end',
  sessionId: 's',
  subject: 'delegator:builder',
  promptId: undefined,
  toolUseId: undefined,
  agentId: 'a',
  status: 'async_launched',
  model: undefined,
  outputFile: undefined,
  durationMs: undefined,
  tokens: undefined,
  toolUses: undefined,
  word: undefined,
  length: undefined,
  capped: false,
};
const RESUME: ResumeRow = {
  time: 't',
  hook: 'resume',
  sessionId: 's',
  agentId: 'a',
  toolUseId: 'toolu_1',
};
const BUILDER: AgentStats = {
  agent: 'delegator:builder',
  launches: 40,
  refused: 0,
  completed: 40,
  capped: 14,
  noReturn: 0,
  returns: 40,
  sentBack: 2,
  contractWords: 40,
  verdicts: {},
  durationMedianMs: undefined,
  tokensMedian: undefined,
  toolUsesMedian: undefined,
};
const PLAN_REVIEWER: AgentStats = {
  ...BUILDER,
  agent: 'delegator:plan-reviewer',
  completed: 0,
  capped: 0,
  returns: 25,
  contractWords: 25,
  verdicts: { GO: 24, REVISE: 1 },
};
const MEASURED = {
  stats: [BUILDER, PLAN_REVIEWER],
  rework: { builders: 40, reworked: 10, finishers: 0, reworkedFinishers: 0 },
  sessions: 31,
};

function getState(rule: string, agent: string) {
  return getFindings(MEASURED).find((finding) => finding.rule === rule && finding.agent === agent)
    ?.state;
}

test('acts on a cap-stop rate over 30 percent and accepts a sent-back rate under 50', () => {
  const states = [
    getState('cap-stop rate', 'delegator:builder'),
    getState('sent-back rate', 'delegator:builder'),
  ];

  assert.deepEqual(states, ['act', 'ok']);
});

test('waits while the sample is under 20', () => {
  const stats = [{ ...BUILDER, completed: 19, capped: 19 }];
  const [finding] = getFindings({ ...MEASURED, stats });

  assert.deepEqual([finding?.rule, finding?.state, finding?.n], ['cap-stop rate', 'wait', 19]);
});

test('counts launches that ended without a return with the capped ones', () => {
  const stats = [{ ...BUILDER, completed: 12, capped: 0, noReturn: 8 }];
  const [finding] = getFindings({ ...MEASURED, stats });

  assert.deepEqual([finding?.value, finding?.state], ['8 of 20, 40 percent', 'act']);
});

test('acts on a plan-reviewer GO rate over 90 percent and only for the plan-reviewer', () => {
  const findings = getFindings(MEASURED).filter((finding) => finding.rule === 'GO rate');

  assert.deepEqual(findings.map((finding) => [finding.agent, finding.state]), [
    ['delegator:plan-reviewer', 'act'],
  ]);
});

test('reads rework after builder from the rework counts', () => {
  const finding = getFindings(MEASURED).find((entry) => entry.rule === 'rework after builder');

  assert.deepEqual([finding?.value, finding?.state], ['10 of 40, 25 percent', 'ok']);
});

test('names every agent type of the roster never launched, acting only after 30 sessions', () => {
  const unused = getFindings(MEASURED).filter((finding) => finding.rule === 'unused agent');
  const early = getFindings({ ...MEASURED, sessions: 29 })
    .filter((finding) => finding.rule === 'unused agent');

  assert.deepEqual(unused.map((finding) => finding.agent), [
    'delegator:diff-reviewer',
    'delegator:finisher',
    'delegator:mcp-operator',
    'delegator:plan-writer',
    'delegator:reader',
    'delegator:runner',
    'delegator:web-researcher',
  ]);
  assert.deepEqual([unused[0]?.state, early[0]?.state], ['act', 'wait']);
});

test('applies the rate rules to agent types of the roster only, not to a refused launch', () => {
  const explore = { ...BUILDER, agent: 'Explore', launches: 0, refused: 1, completed: 0,
    capped: 0, returns: 0, sentBack: 0, contractWords: 0 };
  const findings = getFindings({ ...MEASURED, stats: [explore, BUILDER] });
  const agents = new Set(findings.filter((finding) => finding.rule === 'cap-stop rate')
    .map((finding) => finding.agent));

  assert.deepEqual([...agents], ['delegator:builder']);
});

test('reads a resumed launch without a return as 1 of 1 in the cap-stop rate', () => {
  const stats = getAgentStats([SILENT_END, RESUME]);
  const finding = getFindings({ ...MEASURED, stats })
    .find((entry) => entry.rule === 'cap-stop rate');

  assert.equal(finding?.value, '1 of 1, 100 percent');
});

test('reads rework after finisher right after rework after builder', () => {
  const findings = getFindings({
    ...MEASURED,
    rework: { builders: 40, reworked: 10, finishers: 30, reworkedFinishers: 18 },
  });
  const index = findings.findIndex((finding) => finding.rule === 'rework after builder');

  assert.deepEqual(findings[index + 1], {
    rule: 'rework after finisher',
    agent: 'delegator:finisher',
    value: '18 of 30, 60 percent',
    n: 30,
    threshold: 'over 50 percent at n 20: narrow the slices of the plan',
    state: 'act',
  });
});
