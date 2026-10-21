import { join } from 'node:path';
import { getChildEnv } from '../../shared/get-child-env.ts';
import { readCatalog } from '../../shared/read-catalog.ts';
import { getHistoryViolation } from './branch/get-history-violation.ts';
import { getNameViolation } from './branch/get-name-violation.ts';
import { getTargetViolation } from './branch/get-target-violation.ts';
import { makeBranchFacts } from './branch/make-branch-facts.ts';
import { getInterruptedViolation } from './get-interrupted-violation.ts';
import { getPushCommits } from './get-push-commits.ts';
import { getPushRecords } from './get-push-records.ts';
import { getToolViolation } from './get-tool-violation.ts';
import { testCommit, type Limits } from './test-commit.ts';

const LIMITS: Limits = { gitSeconds: 30, npmTestSeconds: 300 };
const TYPES_PATH = join(import.meta.dirname, '..', '..', 'shared', 'catalogs', 'types.json');

export interface PushInput {
  readonly stdinText: string;
  readonly env: NodeJS.ProcessEnv;
  readonly repository: string;
  readonly tempParent: string;
  readonly signal: AbortSignal;
}

// The first reason to refuse the push, or undefined when the branch rules
// allow it and npm test passes on the commit each pushed ref points to. A
// signal that came while no npm test ran still refuses the push.
export async function getPushViolation(
  { stdinText, env, repository, tempParent, signal }: PushInput,
): Promise<string | undefined> {
  const toolViolation = getToolViolation(env, LIMITS.gitSeconds);

  if (toolViolation !== undefined) {
    return toolViolation;
  }

  const pushRecords = getPushRecords(stdinText);

  if ('violation' in pushRecords) {
    return pushRecords.violation;
  }

  const types = await readCatalog(TYPES_PATH, 'type');

  if ('violation' in types) {
    return types.violation;
  }

  const childEnv = getChildEnv(env, repository, LIMITS.gitSeconds);
  const facts = makeBranchFacts({
    repository, env, childEnv, deadline: Date.now() + LIMITS.gitSeconds * 1000,
  });

  for (const record of pushRecords.records) {
    const branchViolation = getTargetViolation(record, facts)
      ?? getNameViolation(record, facts, types)
      ?? getHistoryViolation(record, facts);

    if (branchViolation !== undefined) {
      return branchViolation;
    }
  }

  const pushCommits = getPushCommits(stdinText);

  if ('violation' in pushCommits) {
    return pushCommits.violation;
  }

  for (const sha of pushCommits.commits) {
    const commitTest = await testCommit({
      repository, sha, env: childEnv, tempParent, limits: LIMITS, signal,
    });

    if ('violation' in commitTest) {
      return commitTest.violation;
    }
  }

  return signal.aborted ? getInterruptedViolation(undefined) : undefined;
}
