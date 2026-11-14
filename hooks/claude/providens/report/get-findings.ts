import { ROSTER } from '../../tyler/launch/get-refusal.ts';
import type { AgentStats } from './get-agent-stats.ts';
import type { Rework } from './get-rework.ts';

// One reading rule applied to one agent: the value, the sample it rests on
// and whether the threshold says to act, to wait for more sample, or that
// the number is fine.
export interface Finding {
  readonly rule: string;
  readonly agent: string;
  readonly value: string;
  readonly n: number;
  readonly threshold: string;
  readonly state: 'act' | 'wait' | 'ok';
}

export interface Measured {
  readonly stats: readonly AgentStats[];
  readonly rework: Rework;
  readonly sessions: number;
}

// A rate over an agent's counts: its name, the count and the sample it is
// taken over, and the percent past which the rule acts.
interface RateRule {
  readonly rule: string;
  readonly getCounts: (stats: AgentStats) => readonly [number, number];
  readonly isOver: (percent: number) => boolean;
  readonly threshold: string;
}

// Launches a reading rule needs before its percent may act.
export const MIN_SAMPLE = 20;

// Sessions without a launch of an agent before it is a drop candidate.
export const MIN_SESSIONS = 30;

const PLAN_REVIEWER = 'providens:plan-reviewer';
const PERCENT = 100;
const ROSTER_AGENTS: readonly string[] = ROSTER.map((name) => `providens:${ name }`);

const RATE_RULES: readonly RateRule[] = [
  // A background subagent that hits its turn cap fires no stop hook: one
  // resumed after a run without a return is counted as capped, and a launch
  // that ended without a return is counted with the capped ones.
  {
    rule: 'cap-stop rate',
    getCounts: (stats) => [stats.capped + stats.noReturn, stats.completed + stats.noReturn],
    isOver: (percent) => percent > 30,
    threshold: `over 30 percent at n ${ String(MIN_SAMPLE) }: split slices, change the cap or `
      + 'the model',
  },
  {
    rule: 'sent-back rate',
    getCounts: (stats) => [stats.sentBack, stats.returns],
    isOver: (percent) => percent > 50,
    threshold: `over 50 percent at n ${ String(MIN_SAMPLE) }: a cap per agent or a shorter `
      + 'return form',
  },
  {
    rule: 'contract word rate',
    getCounts: (stats) => [stats.contractWords, stats.returns],
    isOver: (percent) => percent < 90,
    threshold: `under 90 percent at n ${ String(MIN_SAMPLE) }: fix the contract text`,
  },
];

const PLAN_REVIEWER_RULE: RateRule = {
  rule: 'GO rate',
  getCounts: (stats) => [
    stats.verdicts.GO ?? 0,
    (stats.verdicts.GO ?? 0) + (stats.verdicts.REVISE ?? 0),
  ],
  isOver: (percent) => percent > 90 || percent < 20,
  threshold: `over 90 percent at n ${ String(MIN_SAMPLE) }: remove the plan-reviewer; `
    + 'under 20: read its defects for a plan template fault',
};

// Every reading rule applied to the measured record, agents sorted as given.
export function getFindings(measured: Measured): Finding[] {
  return [
    ...measured.stats.filter((stats) => ROSTER_AGENTS.includes(stats.agent))
      .flatMap((stats) => RATE_RULES.map((rule) => getRateFinding(rule, stats))),
    ...measured.stats.filter((stats) => stats.agent === PLAN_REVIEWER)
      .map((stats) => getRateFinding(PLAN_REVIEWER_RULE, stats)),
    getReworkFinding(measured.rework),
    ...getUnusedFindings(measured),
  ];
}

function getRateFinding(rule: RateRule, stats: AgentStats): Finding {
  return makeRateFinding(rule, stats.agent, rule.getCounts(stats));
}

function getReworkFinding(rework: Rework): Finding {
  const rule: RateRule = {
    rule: 'rework after builder',
    getCounts: () => [rework.reworked, rework.builders],
    isOver: (percent) => percent > 50,
    threshold: `over 50 percent at n ${ String(MIN_SAMPLE) }: change the brief form (ORCH-5)`,
  };

  return makeRateFinding(rule, 'providens:builder', [rework.reworked, rework.builders]);
}

function makeRateFinding(
  rule: RateRule,
  agent: string,
  [count, sample]: readonly [number, number],
): Finding {
  const percent = sample === 0 ? 0 : Math.round((count / sample) * PERCENT);
  const isWaiting = sample < MIN_SAMPLE;

  return {
    rule: rule.rule,
    agent,
    value: `${ String(count) } of ${ String(sample) }, ${ String(percent) } percent`,
    n: sample,
    threshold: rule.threshold,
    state: getState(isWaiting, rule.isOver(percent)),
  };
}

// A roster agent never launched is a drop candidate once enough sessions ran.
function getUnusedFindings(measured: Measured): Finding[] {
  const launched = new Set(measured.stats.filter((stats) => stats.launches > 0)
    .map((stats) => stats.agent));

  return ROSTER_AGENTS
    .filter((agent) => !launched.has(agent))
    .map((agent) => ({
      rule: 'unused agent',
      agent,
      value: `0 launches in ${ String(measured.sessions) } sessions`,
      n: measured.sessions,
      threshold: `0 launches in ${ String(MIN_SESSIONS) } sessions: drop candidate`,
      state: getState(measured.sessions < MIN_SESSIONS, true),
    }));
}

function getState(isWaiting: boolean, isOver: boolean): Finding['state'] {
  if (isWaiting) {
    return 'wait';
  }

  return isOver ? 'act' : 'ok';
}
