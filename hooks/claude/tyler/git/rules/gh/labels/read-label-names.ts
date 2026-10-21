import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface LabelNames {
  readonly names: readonly string[];
}

// The labels an option names, in the order written. gh splits each value on
// commas; the catalog has no label with a comma or a quote, so a quoted part
// stays a name the catalog does not know.
export function readLabelNames(
  args: GhArguments,
  command: string,
  option: string,
): LabelNames | GhRefusal {
  const values = readLiteralValues(args, command, option);

  return 'refusal' in values
    ? values
    : { names: values.texts.flatMap((text) => text.split(',').map((name) => name.trim())) };
}
