import { type DefaultBranchViolation, getDefaultBranches } from './get-default-branches.ts';
import { runExpecting } from './run-expecting.ts';
import { isFailure, type Place } from './run-git.ts';

const SUCCESS = 0;
const NOT_FOUND = 1;
const REMOTE_REFS_ARGS = ['for-each-ref', '--format=%(refname)', 'refs/remotes'];

export interface FactViolation {
  readonly violation: string;
}

export interface BranchFacts {
  // Whether the ref exists before the transaction writes it.
  readonly hasRef: (ref: string) => boolean | FactViolation;
  readonly getDefaultBranches: () => string[] | DefaultBranchViolation;
  // Every ref under refs/remotes/.
  readonly getRemoteRefs: () => string[] | FactViolation;
}

// What the branch rule knows about the repository in the place. The ref
// lists are read from git the first time the rule asks and once per run, so a
// transaction that creates only well-named branches makes no git call.
export function makeBranchFacts(place: Place): BranchFacts {
  return {
    hasRef: (ref) => hasRef(ref, place),
    getDefaultBranches: once(() => getDefaultBranches({
      repository: place.cwd, env: place.env, deadline: place.deadline,
    })),
    getRemoteRefs: once(() => getRemoteRefs(place)),
  };
}

function hasRef(ref: string, place: Place): boolean | FactViolation {
  const args = ['rev-parse', '--verify', '--quiet', ref];
  const run = runExpecting(args, [SUCCESS, NOT_FOUND], place);

  return isFailure(run) ? cannotRead(run.reason) : run.status === SUCCESS;
}

function getRemoteRefs(place: Place): string[] | FactViolation {
  const run = runExpecting(REMOTE_REFS_ARGS, [SUCCESS], place);

  return isFailure(run)
    ? cannotRead(run.reason)
    : run.stdout.split('\n').filter((ref) => ref !== '');
}

function once<Value>(read: () => Value): () => Value {
  let cached: { readonly value: Value } | undefined;

  return () => {
    cached ??= { value: read() };

    return cached.value;
  };
}

function cannotRead(detail: string): FactViolation {
  return { violation: `cannot read the refs (${ detail }); the branch is refused, retry it` };
}
