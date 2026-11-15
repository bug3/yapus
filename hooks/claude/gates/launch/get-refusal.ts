import type { Launch } from './parse-launch.ts';

// The agents of plugins/providens/agents, by file name.
export const ROSTER = [
  'builder', 'diff-reviewer', 'mcp-operator', 'plan-reviewer', 'reader', 'runner',
  'web-researcher',
] as const;

// The Claude Code agent types that stand in for a roster agent.
export const STAND_INS: readonly string[] = [
  'claude', 'Explore', 'fork', 'general-purpose', 'Plan',
];

const ROSTER_TYPES: readonly string[] = ROSTER.map((name) => `providens:${ name }`);
const DEPTH_TAG = /^\[(quick|standard|deep)\] /;

// Why the launch breaks the roster's rules, or undefined when it keeps them.
export function getRefusal(launch: Launch): string | undefined {
  if (launch.isNested) {
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

  if (depth === 'quick') {
    return 'a quick task launches no subagent; do it in this session, or raise the depth';
  }

  return undefined;
}
