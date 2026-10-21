import { runExpecting } from './run-expecting.ts';
import { isFailure, type Place } from './run-git.ts';

const KEY = 'yapus.allowDefaultBranchPush';
const SUCCESS = 0;
const NOT_FOUND = 1;

export interface AllowanceViolation {
  readonly violation: string;
}

// Whether the repository's config lets an agent push to a default branch: the
// key set to true. The key unset or false does not.
export function getPushAllowance(place: Place): boolean | AllowanceViolation {
  const run = runExpecting(['config', '--type=bool', '--get', KEY], [SUCCESS, NOT_FOUND], place);

  if (isFailure(run)) {
    return { violation: `cannot read ${ KEY } (${ run.reason }); the push is blocked, retry it` };
  }

  return run.status === SUCCESS && run.stdout.trim() === 'true';
}
