import { getPlace } from '../git/get-place.ts';
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

  const place = getPlace(input.cwd, context.env, context.deadline);

  if ('kind' in place) {
    return failReview(place.kind === 'no git' ? place.detail : `${ place.reason }; ${ GIT_FIX }`);
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
