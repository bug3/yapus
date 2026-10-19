import { getChange } from '../git/get-change.ts';
import { getPlace } from '../git/get-place.ts';
import { getRiskHits } from '../git/get-risk-hits.ts';
import { getSnapshot } from '../git/get-snapshot.ts';
import { isFailure, type Place } from '../git/run-git.ts';
import { getBase } from '../state/get-base.ts';
import { getThreshold } from '../state/get-threshold.ts';
import type { HookInput } from '../parse-hook-input.ts';
import type { Change, Range } from '../git/get-change.ts';
import type { RiskHit } from '../git/get-risk-hits.ts';

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

const NEXT_STEP = 'check the repository and stop again';

// The session's change and what decides whether it needs review. A directory
// outside a work tree gives none; a git failure gives a failure with the
// instruction to follow. It may throw on a file error; the caller catches.
export function readGateState(
  input: HookInput,
  dataDir: string,
  env: NodeJS.ProcessEnv,
): GateRead {
  const { cwd, sessionId } = input;
  const place = getPlace(cwd, env);

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
