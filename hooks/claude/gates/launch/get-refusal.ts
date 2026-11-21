import type { Launch } from './parse-launch.ts';

// The agent definitions of plugins/delegator/agents, by file name.
export const ROSTER = [
  'builder', 'diff-reviewer', 'finisher', 'mcp-operator', 'plan-reviewer', 'plan-writer',
  'reader', 'runner', 'web-researcher',
] as const;

// The Claude Code agent types that stand in for an agent type of the roster.
export const STAND_INS: readonly string[] = [
  'claude', 'Explore', 'fork', 'general-purpose', 'Plan',
];

const ROSTER_TYPES: readonly string[] = ROSTER.map((name) => `delegator:${ name }`);
const DEPTH_TAG = /^\[(quick|standard|deep)\] /;
const FINISHER = 'delegator:finisher';
const REVIEWER = 'delegator:diff-reviewer';

// Why the launch breaks the roster's rules, or undefined when it keeps them.
export function getRefusal(launch: Launch): string | undefined {
  // The one nested launch the roster admits: a finisher has its own diff reviewed.
  const isFinisherReview = launch.caller?.agentType === FINISHER
    && launch.subagentType === REVIEWER;

  if (launch.caller !== undefined && !isFinisherReview) {
    return 'a subagent launches no agents; return the work to your caller';
  }

  if (STAND_INS.includes(launch.subagentType)) {
    const roster = ROSTER_TYPES.join(', ');

    return `${ launch.subagentType } stands in for the roster; launch one of ${ roster }`;
  }

  const depth = DEPTH_TAG.exec(launch.description)?.[1];

  if (depth === undefined) {
    return 'start the description with the depth in brackets: [quick], [standard] or [deep]';
  }

  if (launch.subagentType === FINISHER && depth !== 'deep') {
    return 'a finisher takes a slice of deep work; start the description with [deep]';
  }

  if (depth === 'quick') {
    return 'a quick task launches no subagent; do it in this session, or raise the depth';
  }

  return undefined;
}
