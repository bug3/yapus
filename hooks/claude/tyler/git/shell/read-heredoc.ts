import { readExpansion } from './read-expansion.ts';
import type { Context } from './read-substitution.ts';
import { makeFailure } from './read-word.ts';
import type { Item, SplitFailure } from './split-commands.ts';

// `isQuoted` is true when the delimiter word held a quote or a backslash.
export interface Heredoc {
  readonly delimiter: string;
  readonly isTabStripped: boolean;
  readonly isQuoted: boolean;
}

export interface HeredocReading {
  readonly heredoc: Heredoc;
  readonly context: Context;
}

// `items` are the commands of the substitutions in an unquoted body, in body order.
export interface HeredocBody {
  readonly kind: 'body';
  readonly text: string;
  readonly items: readonly Item[];
  readonly end: number;
}

export type HeredocResult = HeredocBody | SplitFailure;

interface LogicalLine {
  readonly text: string;
  readonly end: number;
}

const ODD_BACKSLASHES = /(?:^|[^\\])(?:\\\\)*\\$/;
const BODY_ESCAPABLE = '$`\\';

// Reads from the start of a line; `end` is just past the delimiter line.
export function readHeredoc(line: string, start: number, reading: HeredocReading): HeredocResult {
  const { heredoc, context } = reading;
  const lines: string[] = [];
  let position = start;

  while (position < line.length) {
    const logical = readLogicalLine(line, position, heredoc);

    if (logical === undefined) {
      break;
    }

    if (logical.text === heredoc.delimiter) {
      const text = lines.join('\n');
      const items = heredoc.isQuoted ? [] : readSubstitutions(text, context);

      return Array.isArray(items) ? { kind: 'body', text, items, end: logical.end } : items;
    }

    lines.push(logical.text);
    position = logical.end;
  }

  return makeFailure('unterminated heredoc');
}

// Joins continued lines unless the delimiter is quoted; undefined when input ends inside one.
function readLogicalLine(line: string, start: number, heredoc: Heredoc): LogicalLine | undefined {
  let text = '';
  let position = start;

  for (;;) {
    const found = line.indexOf('\n', position);
    const lineEnd = found === -1 ? line.length : found;
    const raw = line.slice(position, lineEnd);
    const piece = heredoc.isTabStripped ? raw.replace(/^\t+/, '') : raw;

    if (heredoc.isQuoted || !ODD_BACKSLASHES.test(piece)) {
      return { text: text + piece, end: Math.min(lineEnd + 1, line.length) };
    }

    if (found === -1) {
      return undefined;
    }

    text += piece.slice(0, -1);
    position = lineEnd + 1;
  }
}

// Reads a body like the inside of double quotes, for substitutions only.
function readSubstitutions(text: string, context: Context): Item[] | SplitFailure {
  const items: Item[] = [];
  let position = 0;

  while (position < text.length) {
    const char = text.charAt(position);
    const next = text.charAt(position + 1);

    if (char === '\\' && next !== '' && BODY_ESCAPABLE.includes(next)) {
      position += 2;
    } else if (char === '$' || char === '`') {
      const expansion = readExpansion(text, position, context);

      if (expansion.kind === 'failure') {
        return expansion;
      }

      if (expansion.kind === 'substitution') {
        items.push(...expansion.items);
      }

      position = expansion.kind === 'substitution' ? expansion.end : position + 1;
    } else {
      position += 1;
    }
  }

  return items;
}
