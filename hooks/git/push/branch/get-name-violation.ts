import { getBranchNameViolation } from '../../../shared/get-branch-name-violation.ts';
import type { Catalog } from '../../../shared/read-catalog.ts';
import { isZeroSha, type PushRecord } from '../get-push-records.ts';
import { isDefaultBranch } from './get-default-branches.ts';
import type { BranchFacts } from './make-branch-facts.ts';

const HEADS = 'refs/heads/';

// The reason to refuse a record, or undefined: an agent pushes only to a
// branch named `<type>/<slug>`, or to a default branch as the target rule
// allows. A deletion, a tag and any other ref are not this rule's concern.
export function getNameViolation(
  record: PushRecord,
  facts: BranchFacts,
  types: Catalog,
): string | undefined {
  if (!facts.isAgent || isZeroSha(record.localSha) || !record.remoteRef.startsWith(HEADS)) {
    return undefined;
  }

  const defaultBranches = facts.getDefaultBranches();

  if ('violation' in defaultBranches) {
    return defaultBranches.violation;
  }

  return isDefaultBranch(defaultBranches, record.remoteRef)
    ? undefined
    : getBranchNameViolation(record.remoteRef.slice(HEADS.length), types);
}
