import { isZeroSha, type PushRecord } from '../get-push-records.ts';
import { isDefaultBranch } from './get-default-branches.ts';
import type { BranchFacts } from './make-branch-facts.ts';

// The reason to refuse a record, or undefined: an agent may not push to a
// default branch unless the repository's config allows it. A deletion is not
// a push to the branch here.
export function getTargetViolation(record: PushRecord, facts: BranchFacts): string | undefined {
  if (!facts.isAgent || isZeroSha(record.localSha)) {
    return undefined;
  }

  const defaultBranches = facts.getDefaultBranches();

  if ('violation' in defaultBranches) {
    return defaultBranches.violation;
  }

  if (!isDefaultBranch(defaultBranches, record.remoteRef)) {
    return undefined;
  }

  const allowance = facts.getPushAllowance();

  if (typeof allowance === 'object') {
    return allowance.violation;
  }

  return allowance
    ? undefined
    : `an agent may not push to ${ record.remoteRef }; push a branch and open a pull request`;
}
