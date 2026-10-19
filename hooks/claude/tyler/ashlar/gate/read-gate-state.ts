import { logDecision } from '../../../providens/log-decision.ts';
import { getChange } from '../git/get-change.ts';
import { getPlace } from '../git/get-place.ts';
import { getRiskHits } from '../git/get-risk-hits.ts';
import { getSnapshot } from '../git/get-snapshot.ts';
import { isFailure, type Place } from '../git/run-git.ts';
import { getBase, HEAD_FALLBACK_REASON } from '../state/get-base.ts';
import { getThreshold } from '../state/get-threshold.ts';
import type { HookInput } from '../parse-hook-input.ts';
import type { Change, Range } from '../git/get-change.ts';
import type { RiskHit } from '../git/get-risk-hits.ts';

// What the gate reads with: the data directory, the hook's environment, the
// time it logs and the epoch milliseconds by which every git call has ended.
export interface GateSetting {
  readonly dataDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly time: string;
  readonly deadline: number;
}

export interface GateState {
  readonly kind: 'state';
  readonly place: Place;
  readonly range: Range;
  readonly change: Change;
  readonly threshold: number;
  readonly hits: readonly RiskHit[];
}

export type GateRead =
  | GateState
  | { readonly kind: 'none' }
  | { readonly kind: 'failure'; readonly detail: string };

export const GATE_HOOK = 'ashlar gate';

const NEXT_STEP = 'check the repository and stop again';

// The session's change and what decides whether it needs review. A directory
// outside a work tree gives none; a git failure gives a failure with the
// instruction to follow. A base that fell back to HEAD is logged as soon as
// it is found, before a later step can fail, as the next run finds it stored.
// It may throw on a file error; the caller catches.
export function readGateState(input: HookInput, setting: GateSetting): GateRead {
  const { cwd, sessionId } = input;
  const { dataDir } = setting;
  const place = getPlace(cwd, setting.env, setting.deadline);

  if ('kind' in place) {
    return place.kind === 'no git'
      ? { kind: 'failure', detail: place.detail }
      : failure(place.reason);
  }

  const found = getSnapshot(place);

  if (found.kind === 'none') {
    return found;
  }

  if (found.kind === 'failure') {
    return failure(found.reason);
  }

  const { root, tree } = found.snapshot;
  const base = getBase(place, { dataDir, sessionId, root });

  if (isFailure(base)) {
    return failure(base.reason);
  }

  if (base.source === 'head') {
    logDecision(dataDir, {
      time: setting.time,
      hook: GATE_HOOK,
      sessionId,
      subject: tree,
      allowed: true,
      reason: HEAD_FALLBACK_REASON,
    });
  }

  const range = { base: base.id, tree };
  const change = getChange(place, range);

  if (isFailure(change)) {
    return failure(change.reason);
  }

  const threshold = getThreshold(dataDir);

  if (threshold.kind === 'failure') {
    return { kind: 'failure', detail: threshold.reason };
  }

  const hits = getRiskHits(place, range, change.files);

  if (isFailure(hits)) {
    return failure(hits.reason);
  }

  return { kind: 'state', place, range, change, threshold: threshold.lines, hits };
}

function failure(reason: string): GateRead {
  return { kind: 'failure', detail: `${ reason }; ${ NEXT_STEP }` };
}
