import type { Heredoc } from './read-heredoc.ts';
import { isWordBoundary, makeFailure, readWord } from './read-word.ts';
import type { SplitFailure } from './split-commands.ts';

export interface NoRedirection {
  readonly kind: 'none';
}

// `end` is just past the operator and its attached target, if any.
export interface RedirectionRead {
  readonly kind: 'redirection';
  readonly hasTarget: boolean;
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

export function readRedirection(line: string, start: number): RedirectionResult {
  let position = start;

  while (/^[0-9]$/.test(line.charAt(position))) {
    position += 1;
  }

  const operator = OPERATORS.find((candidate) => line.startsWith(candidate, position));

  if (operator === undefined || (position > start && operator.startsWith('&'))) {
    return { kind: 'none' };
  }

  if (HEREDOCS.includes(operator)) {
    return readDelimiter(line, position + operator.length, operator === '<<-');
  }

  const after = position + operator.length;
  const next = line.charAt(after);

  if (next === '(' && SUBSTITUTION_OPERATORS.includes(operator)) {
    return makeFailure('substitution not supported yet');
  }

  if (isWordBoundary(next)) {
    return { kind: 'redirection', hasTarget: false, end: after };
  }

  const target = readWord(line, after);

  if (target.kind === 'failure') {
    return target;
  }

  return { kind: 'redirection', hasTarget: target.isPresent, end: target.end };
}

function readDelimiter(line: string, start: number, isTabStripped: boolean): RedirectionResult {
  let position = start;

  while (line.charAt(position) === ' ' || line.charAt(position) === '\t') {
    position += 1;
  }

  const word = readWord(line, position);

  if (word.kind === 'failure') {
    return word;
  }

  if (!word.isPresent) {
    return makeFailure('heredoc without a delimiter');
  }

  return { kind: 'heredoc', heredoc: { delimiter: word.text, isTabStripped }, end: word.end };
}
