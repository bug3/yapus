import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { logDecision } from '../../../providens/log-decision.ts';
import { writeDiff } from '../git/write-diff.ts';
import { isFailure } from '../git/run-git.ts';
import type { HookInput } from '../parse-hook-input.ts';
import { getDiffPath } from '../state/get-diff-path.ts';
import { isAccepted } from '../state/is-accepted.ts';
import { formatRequest } from './format-request.ts';
import { GATE_HOOK, type GateSetting, readGateState } from './read-gate-state.ts';

export type GateContext = GateSetting;

export type GateVerdict =
  | { readonly kind: 'pass' }
  | { readonly kind: 'review'; readonly detail: string }
  | { readonly kind: 'failure'; readonly detail: string };

const PASS: GateVerdict = { kind: 'pass' };

// Whether the session may stop: a change under the threshold that touches no
// risk glob passes and logs no decision; one that needs review passes when a
// review accepted exactly this change, or on the second stop, and otherwise
// is sent back once with the diff written for the reviewer. A session base
// that fell back to HEAD is logged once, whatever the verdict. A git or file
// failure comes back as a failure value.
export function getGateVerdict(input: HookInput, context: GateContext): GateVerdict {
  try {
    return decide(input, context);
  } catch (error) {
    return {
      kind: 'failure',
      detail: `${ getFirstLine(error) }; check the data directory and stop again`,
    };
  }
}

function decide(input: HookInput, context: GateContext): GateVerdict {
  const { dataDir } = context;
  const { sessionId } = input;
  const read = readGateState(input, context);

  if (read.kind !== 'state') {
    return read.kind === 'none' ? PASS : read;
  }

  const { change, hits, place, range } = read;

  if (change.lines <= read.threshold && hits.length === 0) {
    return PASS;
  }

  const log = (isAllowed: boolean, reason: string): void => {
    logDecision(dataDir, {
      time: context.time,
      hook: GATE_HOOK,
      sessionId,
      subject: range.tree,
      allowed: isAllowed,
      reason,
    });
  };

  if (isAccepted(dataDir, sessionId, range)) {
    log(true, 'accepted review');

    return PASS;
  }

  if (input.isRetry) {
    log(true, 'passed without accepted review');

    return PASS;
  }

  const diffPath = getDiffPath(input.scratchpadDir, dataDir, sessionId);
  const written = writeDiff(diffPath, place, range);

  if (isFailure(written)) {
    return { kind: 'failure', detail: `${ written.reason }; check the repository and stop again` };
  }

  log(false, 'sent back for review');

  return {
    kind: 'review',
    detail: formatRequest({
      base: range.base,
      change,
      threshold: read.threshold,
      hits,
      diffPath,
    }),
  };
}
