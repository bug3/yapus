import { getChildEnv } from '../../../../shared/get-child-env.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { type GitFailure, isFailure, LIMIT_SECONDS, type Place, runGit } from './run-git.ts';
import { getVersionShortfall } from './get-version-shortfall.ts';

// Git is missing or too old; detail is the complete message, instruction
// included.
export interface NoGit {
  readonly kind: 'no git';
  readonly detail: string;
}

// Where git runs for one hook run, until deadline. It checks that git starts
// at a version ashlar needs, then drops the variables that tie git to another
// repository, once per run. A git that does not start or is too old gives
// NoGit; a failing variable lookup gives a failure.
export function getPlace(
  cwd: string,
  env: NodeJS.ProcessEnv,
  deadline: number,
): Place | GitFailure | NoGit {
  // The raw env is enough to see whether git starts at all.
  const version = runGit(['--version'], { cwd, env, deadline });

  if (isFailure(version)) {
    return { kind: 'no git', detail: 'git not found; install git' };
  }

  const shortfall = getVersionShortfall(version.stdout);

  if (shortfall !== undefined) {
    return { kind: 'no git', detail: shortfall };
  }

  try {
    return { cwd, env: getChildEnv(env, cwd, LIMIT_SECONDS), deadline };
  } catch (error) {
    return { kind: 'failure', reason: `git rev-parse --local-env-vars: ${ getFirstLine(error) }` };
  }
}
