import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface LabelNames {
  readonly names: readonly string[];
}

// A field of Go's encoding/csv, which pflag splits a list value with: quoted
// (`""` is a quote) or plain (no quote, no comma), then a comma or the end.
const QUOTED_FIELD = /^"((?:[^"]|"")*)"(,|$)/u;
const PLAIN_FIELD = /^([^",]*)(,|$)/u;

// The labels an option names, in the order written. gh splits each value as CSV
// and trims nothing, so `a, b` names `a` and ` b`.
export function readLabelNames(
  args: GhArguments,
  command: string,
  option: string,
): LabelNames | GhRefusal {
  const values = readLiteralValues(args, command, option);

  return 'refusal' in values
    ? values
    : { names: values.texts.flatMap(splitCsv) };
}

// The fields of one value; a value that is not well-formed CSV (gh refuses it) stays
// whole, a name the catalog does not know.
function splitCsv(text: string): readonly string[] {
  const names: string[] = [];
  let rest: string | undefined = text;

  while (rest !== undefined) {
    const match: RegExpExecArray | null = QUOTED_FIELD.exec(rest) ?? PLAIN_FIELD.exec(rest);

    if (match === null) {
      return [text];
    }

    names.push((match[1] ?? '').replaceAll('""', '"'));
    rest = match[2] === ',' ? rest.slice(match[0].length) : undefined;
  }

  return names;
}
