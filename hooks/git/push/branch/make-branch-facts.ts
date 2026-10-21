import { type DefaultBranchViolation, getDefaultBranches } from './get-default-branches.ts';
import { type AllowanceViolation, getPushAllowance } from './get-push-allowance.ts';

export interface BranchFactsQuery {
  readonly repository: string;
  // The hook's own environment, which says whether an agent pushes.
  readonly env: NodeJS.ProcessEnv;
  // The environment of the git calls.
  readonly childEnv: NodeJS.ProcessEnv;
  // Epoch milliseconds by which every git call of the branch rules has ended.
  readonly deadline: number;
}

export interface BranchFacts {
  readonly isAgent: boolean;
  readonly getDefaultBranches: () => string[] | DefaultBranchViolation;
  readonly getPushAllowance: () => boolean | AllowanceViolation;
}

// What the branch rules know about the push. Each fact is read from git the
// first time a rule asks and once per push, so a push that needs none makes no
// git call.
export function makeBranchFacts(query: BranchFactsQuery): BranchFacts {
  const { repository, env, childEnv, deadline } = query;
  const place = { cwd: repository, env: childEnv, deadline };

  return {
    isAgent: env.CLAUDECODE === '1',
    getDefaultBranches: once(
      () => getDefaultBranches({ repository, env: childEnv, deadline }),
    ),
    getPushAllowance: once(() => getPushAllowance(place)),
  };
}

function once<Value>(read: () => Value): () => Value {
  let cached: { readonly value: Value } | undefined;

  return () => {
    cached ??= { value: read() };

    return cached.value;
  };
}
