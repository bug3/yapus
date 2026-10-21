import type { Call } from '../../../calls/get-calls.ts';
import type { GhArguments } from '../read-gh-arguments.ts';

// How the call names another repository or branch than the working directory holds,
// as written (`--repo`, `GH_REPO`, a URL operand), or undefined. `options` are the long options of
// the action that do so.
export function findMovingOption(
  call: Call,
  args: GhArguments,
  options: readonly string[],
): string | undefined {
  const option = options.find((long) => args.values.has(long));

  if (option !== undefined) {
    return `--${ option }`;
  }

  // Any assignment may pick another repository for gh or git (GH_REPO, GIT_DIR,
  // GH_HOST); a URL operand names its own.
  const [assignment] = call.assignments;

  return assignment ?? args.operands.find(({ text }) => text.includes(':'))?.text;
}
