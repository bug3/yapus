import { ghCommands } from '../gh-commands.ts';
import type { GhArguments } from '../read-gh-arguments.ts';

// A reason to refuse an option that fills the title or body from somewhere the
// gate cannot read (an editor, the commits, a template), or undefined.
export function getForbiddenOptionRefusal(args: GhArguments, command: string): string | undefined {
  const found = ghCommands.forbiddenOptions
    .find((option) => args.values.has(option) || args.flags.get(option) === true);

  return found === undefined ? undefined : ghCommands.reasons.forbiddenOption(command, found);
}
