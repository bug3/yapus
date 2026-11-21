import { getBranchNameViolation } from '../../shared/get-branch-name-violation.ts';
import type { Catalog } from '../../shared/read-catalog.ts';
import { isDefaultBranch } from './get-default-branches.ts';
import { getBranchName } from './get-ref-updates.ts';
import type { BranchFacts, FactViolation } from './make-branch-facts.ts';

const REMOTES = 'refs/remotes/';

// The reason to refuse an update with an all-zero old value to the
// refs/heads/ ref, or undefined. A name of the form `<type>/<slug>` passes
// with no git call; any other name passes only when the ref already exists (a
// forced update), names a default branch, or names a branch a remote has (the
// agent checks out a branch that was already pushed). The excuses run in
// order and stop at the first answer, so a later one reads git only when
// needed.
export function getCreationViolation(
  ref: string,
  facts: BranchFacts,
  types: Catalog,
): string | undefined {
  const name = getBranchName(ref);
  const nameViolation = getBranchNameViolation(name, types);

  if (nameViolation === undefined) {
    return undefined;
  }

  const excuses: readonly (() => boolean | FactViolation)[] = [
    () => facts.hasRef(ref),
    () => isDefault(facts, ref),
    () => hasRemoteBranch(facts, name),
  ];

  for (const excuse of excuses) {
    const answer = excuse();

    if (typeof answer !== 'boolean') {
      return answer.violation;
    }

    if (answer) {
      return undefined;
    }
  }

  return nameViolation;
}

function isDefault(facts: BranchFacts, ref: string): boolean | FactViolation {
  const defaultBranches = facts.getDefaultBranches();

  return 'violation' in defaultBranches ? defaultBranches : isDefaultBranch(defaultBranches, ref);
}

// Whether some refs/remotes/<remote>/<name> exists, the remote one segment.
function hasRemoteBranch(facts: BranchFacts, name: string): boolean | FactViolation {
  const remoteRefs = facts.getRemoteRefs();

  return 'violation' in remoteRefs
    ? remoteRefs
    : remoteRefs.some((remoteRef) => isRemoteBranch(remoteRef, name));
}

function isRemoteBranch(remoteRef: string, name: string): boolean {
  const remote = remoteRef.slice(REMOTES.length, remoteRef.length - name.length - 1);
  const isOneSegment = remote !== '' && !remote.includes('/');

  return isOneSegment && remoteRef === `${ REMOTES }${ remote }/${ name }`;
}
