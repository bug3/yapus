import { ghCommands } from '../gh-commands.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface LiteralValues {
  readonly texts: readonly string[];
}

// The values of an option as text, in the order written; a value the shell
// expands is refused, since the gate cannot judge what it will be.
export function readLiteralValues(
  args: GhArguments,
  command: string,
  option: string,
): LiteralValues | GhRefusal {
  const words = args.values.get(option) ?? [];

  return words.some(({ isOpaque }) => isOpaque)
    ? { refusal: ghCommands.reasons.literalValue(command, option.replaceAll('-', ' ')) }
    : { texts: words.map(({ text }) => text) };
}
