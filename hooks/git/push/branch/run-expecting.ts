import { getFirstLine } from '../../../shared/get-first-line.ts';
import { failed, type GitFailure, type GitRun, isFailure, type Place, runGit } from './run-git.ts';

// A git run whose exit is one of the expected statuses; any other exit comes
// back as a failure with the first stderr line, like any other failed run.
export function runExpecting(
  args: readonly string[],
  statuses: readonly number[],
  place: Place,
): GitRun | GitFailure {
  const run = runGit(args, place);

  if (isFailure(run) || statuses.includes(run.status)) {
    return run;
  }

  return failed(args, `exit ${ String(run.status) }: ${ getFirstLine(run.stderr) }`);
}
