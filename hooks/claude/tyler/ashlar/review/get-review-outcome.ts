import { getChildEnv } from '../../../../shared/get-child-env.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { isFailure, LIMIT_SECONDS, type Place, runGit } from '../git/run-git.ts';
import type { HookInput } from '../parse-hook-input.ts';
import {
  failReview,
  GIT_FIX,
  type ReviewContext,
  type ReviewOutcome,
} from './fail-review.ts';
import { getStartOutcome } from './get-start-outcome.ts';
import { getStopOutcome } from './get-stop-outcome.ts';

export type { ReviewContext, ReviewOutcome };

// What the hook does for one event of the reviewer: checks the agent id and
// git, sets up where git runs, and hands the event to its module. A failure
// comes back as a value.
export function getReviewOutcome(input: HookInput, context: ReviewContext): ReviewOutcome {
  const { agentId } = input;

  if (agentId === undefined) {
    return failReview('agent_id is missing; fix the hook matcher');
  }

  if (isFailure(runGit(['--version'], { cwd: input.cwd, env: context.env }))) {
    return failReview('git not found; install git');
  }

  const place = getPlace(input, context);

  if (typeof place === 'string') {
    return failReview(place);
  }

  const agentInput = { ...input, agentId };

  switch (input.event) {
    case 'SubagentStart':
      return getStartOutcome(agentInput, place, context);
    case 'SubagentStop':
      return getStopOutcome(agentInput, place, context);
    default:
      return failReview(`unexpected event ${ input.event }; fix the hook matcher`);
  }
}

function getPlace(input: HookInput, context: ReviewContext): Place | string {
  try {
    return { cwd: input.cwd, env: getChildEnv(context.env, input.cwd, LIMIT_SECONDS) };
  } catch (error) {
    return `git rev-parse --local-env-vars: ${ getFirstLine(error) }; ${ GIT_FIX }`;
  }
}
