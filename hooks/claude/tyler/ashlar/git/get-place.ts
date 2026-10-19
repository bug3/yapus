import { getChildEnv } from '../../../../shared/get-child-env.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { type GitFailure, isFailure, LIMIT_SECONDS, type Place, runGit } from './run-git.ts';

// Git could not start; detail is the complete message, instruction included.
export interface NoGit {
  readonly kind: 'no git';
  readonly detail: string;
}

// Where git runs for one hook run. It checks that git starts, then drops the
// variables that tie git to another repository, once per run. A git that does
// not start gives NoGit; a failing variable lookup gives a failure.
export function getPlace(cwd: string, env: NodeJS.ProcessEnv): Place | GitFailure | NoGit {
  // The raw env is enough to see whether git starts at all.
  if (isFailure(runGit(['--version'], { cwd, env }))) {
    return { kind: 'no git', detail: 'git not found; install git' };
  }

  try {
    return { cwd, env: getChildEnv(env, cwd, LIMIT_SECONDS) };
  } catch (error) {
    return { kind: 'failure', reason: `git rev-parse --local-env-vars: ${ getFirstLine(error) }` };
  }
}
