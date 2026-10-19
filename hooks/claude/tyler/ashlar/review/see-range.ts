import { getSnapshot } from '../git/get-snapshot.ts';
import type { Range } from '../git/get-change.ts';
import { isFailure, type Place } from '../git/run-git.ts';
import type { HookInput } from '../parse-hook-input.ts';
import { getBase } from '../state/get-base.ts';
import { GIT_FIX, type ReviewContext } from './fail-review.ts';

export type Seen =
  | { readonly kind: 'range'; readonly range: Range }
  | { readonly kind: 'none' }
  | { readonly kind: 'failure'; readonly detail: string };

// The session's base and the working tree now, or none outside a repository.
// A git failure comes back as a value with its instruction.
export function seeRange(input: HookInput, place: Place, context: ReviewContext): Seen {
  const snapshot = getSnapshot(place);

  if (snapshot.kind === 'none') {
    return { kind: 'none' };
  }

  if (snapshot.kind === 'failure') {
    return { kind: 'failure', detail: `${ snapshot.reason }; ${ GIT_FIX }` };
  }

  const { root, tree } = snapshot.snapshot;
  const base = getBase(place, { dataDir: context.dataDir, sessionId: input.sessionId, root });

  if (isFailure(base)) {
    return { kind: 'failure', detail: `${ base.reason }; ${ GIT_FIX }` };
  }

  return { kind: 'range', range: { base: base.id, tree } };
}
