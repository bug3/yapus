import { isFailure, type Place } from '../git/run-git.ts';
import { writeDiff } from '../git/write-diff.ts';
import { getDiffPath } from '../state/get-diff-path.ts';
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
// their diff for warden and records both for the stop. Outside a repository it
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

  const diffPath = getDiffPath(input.scratchpadDir, context.dataDir, input.sessionId);
  const written = writeDiff(diffPath, place, seen.range);

  if (isFailure(written)) {
    return failReview(`${ written.reason }; ${ GIT_FIX }`);
  }

  recordReview(getReviewPath(context.dataDir, input.sessionId, input.agentId), seen.range);

  return { kind: 'pass' };
}
