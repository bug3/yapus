import { readBodyFile } from '../body/read-body-file.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface ScanText {
  readonly text: string;
}

// The text the scanner is given: the last value of each named option that the call
// has, or the text of its body file, one per line, in the order named.
export function readScanText(
  args: GhArguments,
  command: string,
  options: readonly string[],
): ScanText | GhRefusal {
  const parts: string[] = [];

  for (const option of options.filter((name) => args.values.has(name))) {
    const part = option === 'body-file'
      ? readBodyFile(args, command)
      : readLiteralValues(args, command, option);

    if ('refusal' in part) {
      return part;
    }

    parts.push('text' in part ? part.text : part.texts.at(-1) ?? '');
  }

  return { text: parts.join('\n') };
}
