import type { Call } from '../../calls/get-calls.ts';
import { getGhAction } from './get-gh-action.ts';
import { ghCommands } from './gh-commands.ts';
import { readGhArguments } from './read-gh-arguments.ts';

const { merge, reasons } = ghCommands;

// A reason to refuse a `gh pr merge` that is not one merge or squash commit with the
// branch deleted, or that skips the checks or waits for them, or undefined.
export function getMergeRefusal(call: Call): string | undefined {
  const action = getGhAction(call.words);
  const spec = ghCommands.actions.get(action);

  if (call.tool !== 'gh' || action !== 'pr merge' || spec === undefined) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  if ('refusal' in args) {
    return args.refusal;
  }

  const forbidden = merge.forbidden.find((long) => args.flags.get(long) === true);
  const kinds = merge.kinds.filter((long) => args.flags.get(long) === true);
  const missing = merge.required.find((long) => args.flags.get(long) !== true);

  if (forbidden !== undefined) {
    return reasons.mergeForbidden(spec.command, forbidden);
  }

  if (kinds.length !== 1) {
    return reasons.mergeKind(spec.command);
  }

  return missing === undefined ? undefined : reasons.missingOption(spec.command, `--${ missing }`);
}
