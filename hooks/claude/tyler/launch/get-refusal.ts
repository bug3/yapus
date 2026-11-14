import type { Launch } from './parse-launch.ts';

// The agents of plugins/providens/agents, by file name.
export const ROSTER = [
  'builder', 'diff-reviewer', 'plan-reviewer', 'proctor', 'reader', 'webscribe',
] as const;

const ROSTER_TYPES: readonly string[] = ROSTER.map((name) => `providens:${ name }`);
const DEPTH_TAG = /^\[(quick|standard|deep)\] /;

// Why the launch breaks the roster's rules, or undefined when it keeps them.
export function getRefusal(launch: Launch): string | undefined {
  if (launch.isNested) {
    return 'a subagent launches no agents; return the work to your caller';
  }

  if (!ROSTER_TYPES.includes(launch.subagentType)) {
    const roster = ROSTER_TYPES.join(', ');

    return `${ launch.subagentType } is not on the roster; launch one of ${ roster }`;
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
