import { getChildEnv } from './get-child-env.ts';
import { getPushCommits } from './get-push-commits.ts';
import { getToolViolation } from './get-tool-violation.ts';
import { testCommit, type Limits } from './test-commit.ts';

const LIMITS: Limits = { gitSeconds: 30, npmTestSeconds: 300 };

export interface PushInput {
  readonly stdinText: string;
  readonly env: NodeJS.ProcessEnv;
  readonly repository: string;
  readonly tempParent: string;
  readonly signal: AbortSignal;
}

// The first reason to refuse the push, or undefined when npm test passes on
// the commit each pushed ref points to.
export async function getPushViolation(
  { stdinText, env, repository, tempParent, signal }: PushInput,
): Promise<string | undefined> {
  const toolViolation = getToolViolation(env, LIMITS.gitSeconds);

  if (toolViolation !== undefined) {
    return toolViolation;
  }

  const pushCommits = getPushCommits(stdinText);

  if ('violation' in pushCommits) {
    return pushCommits.violation;
  }

  const childEnv = getChildEnv(env, repository, LIMITS.gitSeconds);

  for (const sha of pushCommits.commits) {
    const commitTest = await testCommit({
      repository, sha, env: childEnv, tempParent, limits: LIMITS, signal,
    });

    if ('violation' in commitTest) {
      return commitTest.violation;
    }
  }

  return undefined;
}
