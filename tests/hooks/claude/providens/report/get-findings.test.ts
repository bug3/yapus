import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AgentStats } from '../../../../../hooks/claude/providens/report/get-agent-stats.ts';
import { getFindings } from '../../../../../hooks/claude/providens/report/get-findings.ts';

const BUILDER: AgentStats = {
  agent: 'providens:builder',
  launches: 40,
  refused: 0,
  completed: 40,
  capped: 14,
  returns: 40,
  sentBack: 2,
  contractWords: 40,
  verdicts: {},
  durationMedianMs: undefined,
  tokensMedian: undefined,
  toolUsesMedian: undefined,
};
const CRITIC: AgentStats = {
  ...BUILDER,
  agent: 'providens:critic',
  completed: 0,
  capped: 0,
  returns: 25,
  contractWords: 25,
  verdicts: { GO: 24, REVISE: 1 },
};
const MEASURED = {
  stats: [BUILDER, CRITIC],
  rework: { builders: 40, reworked: 10 },
  sessions: 31,
};

function getState(rule: string, agent: string) {
  return getFindings(MEASURED).find((finding) => finding.rule === rule && finding.agent === agent)
    ?.state;
}

test('acts on a cap-stop rate over 30 percent and accepts a sent-back rate under 50', () => {
  const states = [
    getState('cap-stop rate', 'providens:builder'),
    getState('sent-back rate', 'providens:builder'),
  ];

  assert.deepEqual(states, ['act', 'ok']);
});

test('waits while the sample is under 20', () => {
  const stats = [{ ...BUILDER, completed: 19, capped: 19 }];
  const [finding] = getFindings({ ...MEASURED, stats });

  assert.deepEqual([finding?.rule, finding?.state, finding?.n], ['cap-stop rate', 'wait', 19]);
});

test('acts on a critic GO rate over 90 percent and only for the critic', () => {
  const findings = getFindings(MEASURED).filter((finding) => finding.rule === 'GO rate');

  assert.deepEqual(findings.map((finding) => [finding.agent, finding.state]), [
    ['providens:critic', 'act'],
  ]);
});

test('reads rework after builder from the rework counts', () => {
  const finding = getFindings(MEASURED).find((entry) => entry.rule === 'rework after builder');

  assert.deepEqual([finding?.value, finding?.state], ['10 of 40, 25 percent', 'ok']);
});

test('names every roster agent never launched, acting only after 30 sessions', () => {
  const unused = getFindings(MEASURED).filter((finding) => finding.rule === 'unused agent');
  const early = getFindings({ ...MEASURED, sessions: 29 })
    .filter((finding) => finding.rule === 'unused agent');

  assert.deepEqual(unused.map((finding) => finding.agent), [
    'providens:deacon',
    'providens:proctor',
    'providens:warden',
    'providens:webscribe',
  ]);
  assert.deepEqual([unused[0]?.state, early[0]?.state], ['act', 'wait']);
});
