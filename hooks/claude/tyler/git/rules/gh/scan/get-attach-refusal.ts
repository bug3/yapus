import type { Call } from '../../../calls/get-calls.ts';
import { getGhAction } from '../get-gh-action.ts';
import { ghCommands } from '../gh-commands.ts';
import { readGhArguments } from '../read-gh-arguments.ts';

// A reason to refuse a gh call whose action has an `--attach` option and whose
// words use it, since the file it uploads is one the gate cannot scan, or undefined.
export function getAttachRefusal(call: Call): string | undefined {
  const spec = ghCommands.actions.get(getGhAction(call.words));

  if (call.tool !== 'gh' || spec === undefined) {
    return undefined;
  }

  const { attachOption } = ghCommands;
  const args = readGhArguments(call.words.slice(2), spec);

  return spec.options.some(({ long }) => long === attachOption)
    && 'values' in args && args.values.has(attachOption)
    ? ghCommands.reasons.attachUpload(spec.command, attachOption)
    : undefined;
}
