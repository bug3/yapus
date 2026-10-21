import { ghCommands } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface LabelNames {
  readonly names: readonly string[];
}

// A field of Go's encoding/csv, which pflag splits a list value with: quoted
// (`""` is a quote) or plain (no quote, no comma), then a comma or the end.
const QUOTED_FIELD = /^"((?:[^"]|"")*)"(,|$)/u;
const PLAIN_FIELD = /^([^",]*)(,|$)/u;
const LINE_BREAK = /[\r\n]/u;

// The labels an option names, in the order written. gh splits each value as CSV
// and trims nothing, so `a, b` names `a` and ` b`.
export function readLabelNames(
  args: GhArguments,
  command: string,
  option: string,
): LabelNames | GhRefusal {
  const values = readLiteralValues(args, command, option);

  if ('refusal' in values) {
    return values;
  }

  const names: string[] = [];

  for (const text of values.texts) {
    const fields = LINE_BREAK.test(text) ? undefined : splitCsv(text);

    if (fields === undefined) {
      return { refusal: ghCommands.reasons.labelList(command, option) };
    }

    names.push(...fields);
  }

  return { names };
}

// The fields of one value, or undefined when it is not well-formed CSV (unbalanced
// quotes, text after a closing quote), which gh refuses too.
function splitCsv(text: string): readonly string[] | undefined {
  const names: string[] = [];
  let rest: string | undefined = text;

  while (rest !== undefined) {
    const match: RegExpExecArray | null = QUOTED_FIELD.exec(rest) ?? PLAIN_FIELD.exec(rest);

    if (match === null) {
      return undefined;
    }

    names.push((match[1] ?? '').replaceAll('""', '"'));
    rest = match[2] === ',' ? rest.slice(match[0].length) : undefined;
  }

  return names;
}
