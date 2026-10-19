import { logDecision } from '../../../providens/log-decision.ts';
import { isFailure, type Place } from '../git/run-git.ts';
import { getDiffPath } from '../git/get-diff-path.ts';
import { writeDiff } from '../git/write-diff.ts';
import { HEAD_FALLBACK_REASON } from '../state/get-base.ts';
import {
  type AgentInput,
  failReview,
  GIT_FIX,
  type ReviewContext,
  type ReviewOutcome,
} from './fail-review.ts';
import { getReviewPath, recordReview } from './record-review.ts';
import { seeRange } from './see-range.ts';

// SubagentStart: notes the base and the working tree as a tree id, writes
// their diff for warden and records both for the stop; a base that fell back
// to HEAD is logged. Outside a repository it
// passes and writes nothing; a failure comes back as a value.
export function getStartOutcome(
  input: AgentInput,
  place: Place,
  context: ReviewContext,
): ReviewOutcome {
  const seen = seeRange(input, place, context);

  if (seen.kind === 'none') {
    return { kind: 'pass' };
  }

  if (seen.kind === 'failure') {
    return failReview(seen.detail);
  }

  if (seen.baseSource === 'head') {
    logDecision(context.dataDir, {
      time: context.time,
      hook: 'ashlar review',
      sessionId: input.sessionId,
      subject: seen.range.tree,
      allowed: true,
      reason: HEAD_FALLBACK_REASON,
    });
  }

  const diffPath = getDiffPath(place, input.sessionId);

  if (isFailure(diffPath)) {
    return failReview(`${ diffPath.reason }; ${ GIT_FIX }`);
  }

  const written = writeDiff(diffPath, place, seen.range);

  if (isFailure(written)) {
    return failReview(`${ written.reason }; ${ GIT_FIX }`);
  }

  recordReview(getReviewPath(context.dataDir, input.sessionId, input.agentId), seen.range);

  return { kind: 'pass' };
}
