import { getBranchNameViolation } from '../../../../../shared/get-branch-name-violation.ts';
import { readCatalog } from '../../../../../shared/read-catalog.ts';
import type { Call } from '../../calls/get-calls.ts';
import { getUnreadableReason, isUnreadable } from '../get-unreadable-reason.ts';
import { branchCatalog } from './branch-catalog.ts';
import { readCreatedBranch } from './read-created-branch.ts';

const types = await readCatalog(branchCatalog.typesPath, 'type');

// A reason to refuse a git call that creates or renames a branch to a name
// that is not `<type>/<slug>`, or undefined.
export function getBranchRefusal(call: Call): string | undefined {
  if (call.tool !== 'git') {
    return undefined;
  }

  const created = readCreatedBranch(call.words);

  if (created === 'none') {
    return undefined;
  }

  const command = `git ${ call.words[0]?.text ?? '' }`;

  if (created === 'unreadable' || isUnreadable(created) || created.isOpaque) {
    return getUnreadableReason(command);
  }

  if (branchCatalog.freeNames.some((name) => name === created.text)) {
    return undefined;
  }

  return 'violation' in types ? types.violation : getBranchNameViolation(created.text, types);
}
