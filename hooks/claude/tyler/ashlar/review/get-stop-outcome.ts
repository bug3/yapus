import { logDecision } from '../../../providens/log-decision.ts';
import type { Range } from '../git/get-change.ts';
import type { Place } from '../git/run-git.ts';
import { recordAcceptance } from '../state/record-acceptance.ts';
import {
  type AgentInput,
  failReview,
  type ReviewContext,
  type ReviewOutcome,
} from './fail-review.ts';
import { isApproval } from './is-approval.ts';
import { readReview } from './read-review.ts';
import { getReviewPath } from './record-review.ts';
import { seeRange } from './see-range.ts';

const ACCEPTED = 'accepted';

// SubagentStop: records an acceptance only when the tree and the base are
// those of the start and the reply approves. Every stop that is not a failure
// is logged and passes; a failure comes back as a value.
export function getStopOutcome(
  input: AgentInput,
  place: Place,
  context: ReviewContext,
): ReviewOutcome {
  const started = readReview(getReviewPath(context.dataDir, input.sessionId, input.agentId));

  if (started === undefined) {
    return log(input, context, { subject: 'none', reason: 'no start record' });
  }

  const seen = seeRange(input, place, context);

  if (seen.kind === 'none') {
    return log(input, context, { subject: 'none', reason: 'no repository at stop' });
  }

  if (seen.kind === 'failure') {
    return failReview(seen.detail);
  }

  const reason = getReason(started, seen.range, input.message ?? '');

  if (reason === ACCEPTED) {
    const { agentId } = input;

    recordAcceptance(context.dataDir, input.sessionId, {
      time: context.time,
      agentId,
      ...seen.range,
    });
  }

  return log(input, context, { subject: seen.range.tree, reason });
}

function getReason(started: Range, current: Range, message: string): string {
  if (started.tree !== current.tree) {
    return 'the working tree changed during the review';
  }

  if (started.base !== current.base) {
    return 'the base changed during the review';
  }

  return isApproval(message) ? ACCEPTED : 'not approved';
}

function log(
  input: AgentInput,
  context: ReviewContext,
  { subject, reason }: { readonly subject: string; readonly reason: string },
): ReviewOutcome {
  logDecision(context.dataDir, {
    time: context.time,
    hook: 'ashlar review',
    sessionId: input.sessionId,
    subject,
    allowed: reason === ACCEPTED,
    reason,
  });

  return { kind: 'pass' };
}
