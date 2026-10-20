import { type Context, makeFailure, type SplitFailure } from './make-failure.ts';
import type { Heredoc } from './read-heredoc.ts';
import { isWordBoundary, readWord } from './read-word.ts';
import type { Item } from './split-commands.ts';

export interface NoRedirection {
  readonly kind: 'none';
}

// `end` is just past the operator and its attached target, if any; `items` are the
// commands of substitutions in that target.
export interface RedirectionRead {
  readonly kind: 'redirection';
  readonly hasTarget: boolean;
  readonly items: readonly Item[];
  readonly end: number;
}

// `end` is just past the delimiter word; the body is read at the next newline.
export interface HeredocRead {
  readonly kind: 'heredoc';
  readonly heredoc: Heredoc;
  readonly end: number;
}

export type RedirectionResult = NoRedirection | RedirectionRead | HeredocRead | SplitFailure;

// Longest operators first, so the first match is the longest.
const OPERATORS = ['&>>', '<<<', '<<-', '>>', '>|', '<>', '&>', '>&', '<&', '<<', '<', '>'];
const HEREDOCS = ['<<', '<<-'];
const SUBSTITUTION_OPERATORS = ['<', '>'];

export function readRedirection(
  line: string,
  start: number,
  context: Context,
): RedirectionResult {
  let position = start;

  while (/^[0-9]$/.test(line.charAt(position))) {
    position += 1;
  }

  const operator = OPERATORS.find((candidate) => line.startsWith(candidate, position));

  if (operator === undefined || (position > start && operator.startsWith('&'))) {
    return { kind: 'none' };
  }

  if (HEREDOCS.includes(operator)) {
    return readDelimiter(line, position + operator.length, {
      isTabStripped: operator === '<<-',
      context,
    });
  }

  const after = position + operator.length;
  const next = line.charAt(after);

  if (next === '(' && SUBSTITUTION_OPERATORS.includes(operator)) {
    return { kind: 'none' };
  }

  if (isWordBoundary(next)) {
    return { kind: 'redirection', hasTarget: false, items: [], end: after };
  }

  const target = readWord(line, after, context);

  if (target.kind === 'failure') {
    return target;
  }

  return {
    kind: 'redirection',
    hasTarget: target.isPresent,
    items: target.items,
    end: target.end,
  };
}

interface DelimiterOptions {
  readonly isTabStripped: boolean;
  readonly context: Context;
}

function readDelimiter(
  line: string,
  start: number,
  options: DelimiterOptions,
): RedirectionResult {
  let position = start;

  while (line.charAt(position) === ' ' || line.charAt(position) === '\t') {
    position += 1;
  }

  const word = readWord(line, position, options.context);

  if (word.kind === 'failure') {
    return word;
  }

  if (!word.isPresent) {
    return makeFailure('heredoc without a delimiter');
  }

  // Bash decodes or expands an opaque delimiter, so its source text is not the delimiter.
  if (word.isOpaque) {
    return makeFailure('heredoc delimiter the gate cannot read');
  }

  return {
    kind: 'heredoc',
    heredoc: {
      delimiter: word.text,
      isTabStripped: options.isTabStripped,
      isQuoted: /['"\\]/.test(line.slice(position, word.end)),
    },
    end: word.end,
  };
}
