import { join } from 'node:path';
import { readCatalog } from '../../shared/read-catalog.ts';
import { getCreationViolation } from './get-creation-violation.ts';
import { canCreateBranch, getRefUpdates } from './get-ref-updates.ts';
import { makeBranchFacts } from './make-branch-facts.ts';

const TYPES_PATH = join(import.meta.dirname, '..', '..', 'shared', 'catalogs', 'types.json');
// The budget of every git call of one run together.
const GIT_LIMIT_SECONDS = 10;

export interface BranchInput {
  // The ref lines git writes to the hook.
  readonly stdinText: string;
  // The hook's environment as git gives it, passed to every git call.
  readonly env: NodeJS.ProcessEnv;
  readonly repository: string;
}

// The reason to refuse the transaction, or undefined: the first update that
// creates a branch whose name the rule refuses, a malformed ref line, an
// unreadable types catalog or a git call that fails. Reads git, writes nothing.
export async function getBranchViolation(
  { stdinText, env, repository }: BranchInput,
): Promise<string | undefined> {
  const refUpdates = getRefUpdates(stdinText);

  if ('violation' in refUpdates) {
    return refUpdates.violation;
  }

  const candidates = refUpdates.updates.filter(canCreateBranch);

  if (candidates.length === 0) {
    return undefined;
  }

  const types = await readCatalog(TYPES_PATH, 'type');

  if ('violation' in types) {
    return types.violation;
  }

  const facts = makeBranchFacts({
    cwd: repository, env, deadline: Date.now() + GIT_LIMIT_SECONDS * 1000,
  });

  for (const candidate of candidates) {
    const violation = getCreationViolation(candidate.ref, facts, types);

    if (violation !== undefined) {
      return violation;
    }
  }

  return undefined;
}
