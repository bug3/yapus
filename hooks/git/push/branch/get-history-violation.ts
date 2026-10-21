import { isZeroSha, type PushRecord } from '../get-push-records.ts';
import { isDefaultBranch } from './get-default-branches.ts';
import type { BranchFacts } from './make-branch-facts.ts';
import { runExpecting } from './run-expecting.ts';
import { isFailure } from './run-git.ts';

const IS_ANCESTOR = 0;
const NOT_ANCESTOR = 1;
const OBJECT_MISSING = 128;
const PERSON_DOES_IT = 'a person does it on the server';

interface ForceCheck {
  readonly violation: string;
}

// The reason to refuse a record that deletes a ref or rewrites its history,
// or undefined. Nobody may do either to a default branch; an agent may not
// delete any branch. A force to another branch is not this rule's concern.
export function getHistoryViolation(record: PushRecord, facts: BranchFacts): string | undefined {
  const isDeletion = isZeroSha(record.localSha);
  const force = isDeletion ? false : isForce(record, facts);

  if (typeof force === 'object') {
    return force.violation;
  }

  if (!isDeletion && !force) {
    return undefined;
  }

  const defaultBranches = facts.getDefaultBranches();

  if ('violation' in defaultBranches) {
    return defaultBranches.violation;
  }

  if (isDefaultBranch(defaultBranches, record.remoteRef)) {
    return `${ isDeletion ? 'deletes' : 'rewrites' } ${ record.remoteRef }; ${ PERSON_DOES_IT }`;
  }

  return isDeletion && facts.isAgent
    ? `an agent may not delete ${ record.remoteRef }; ${ PERSON_DOES_IT }`
    : undefined;
}

// A force is a push whose remote sha is no ancestor of the local one; a remote
// sha the repository does not have counts as one.
function isForce(record: PushRecord, facts: BranchFacts): boolean | ForceCheck {
  if (isZeroSha(record.remoteSha)) {
    return false;
  }

  const args = ['merge-base', '--is-ancestor', record.remoteSha, record.localSha];
  const run = runExpecting(args, [IS_ANCESTOR, NOT_ANCESTOR, OBJECT_MISSING], facts.place);

  if (isFailure(run)) {
    const detail = `cannot compare ${ record.remoteRef } with the push (${ run.reason })`;

    return { violation: `${ detail }; the push is blocked, retry it` };
  }

  return run.status !== IS_ANCESTOR;
}
