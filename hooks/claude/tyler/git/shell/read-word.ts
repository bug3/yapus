import { readExpansion } from './read-expansion.ts';
import type { Context } from './read-substitution.ts';
import type { Item, SplitFailure } from './split-commands.ts';

export type Tilde = 'none' | 'home' | 'user';

// `items` are the commands of the substitutions in the word, to run before it;
// `isOpaque` is true when the word holds an expansion of any kind, a glob or brace
// pattern, or a leading zsh `=`.
export interface WordRead {
  readonly kind: 'word';
  readonly text: string;
  readonly isPresent: boolean;
  readonly isPlain: boolean;
  readonly isOpaque: boolean;
  readonly items: readonly Item[];
  readonly tilde: Tilde;
  readonly end: number;
}

export type Read = WordRead | SplitFailure;

interface Accumulator {
  text: string;
  isPresent: boolean;
  isPlain: boolean;
  isOpaque: boolean;
  isInDoubleQuotes: boolean;
  // The unquoted characters of the word, with QUOTED_PART for each quoted part or expansion.
  pattern: string;
  readonly items: Item[];
  readonly context: Context;
}

const BOUNDARIES = ' \t\n&|;()<>';
const DOUBLE_QUOTE_ESCAPABLE = '"\\$`';
const QUOTED_PART = ' ';
const GLOB = /[*?[]/;
// A brace that encloses a comma or `..`; wider than bash's own match, never narrower.
const BRACE_EXPANSION = /\{.*(?:,|\.\.).*\}/;
// zsh replaces a word that starts with `=` by the path of the command after it.
const EQUALS_EXPANSION = /^=./;

export function isWordBoundary(char: string): boolean {
  return char === '' || BOUNDARIES.includes(char);
}

export function makeFailure(reason: string): SplitFailure {
  return { kind: 'failure', reason };
}

// `isPlain` is true when no quote or backslash was used; `tilde` describes a
// leading unquoted `~`.
export function readWord(line: string, start: number, context: Context): Read {
  const word: Accumulator = {
    text: '',
    isPresent: false,
    isPlain: true,
    isOpaque: false,
    isInDoubleQuotes: false,
    pattern: '',
    items: [],
    context,
  };
  let position = start;

  while (position < line.length) {
    // zsh reads `(` inside a word as a glob group, whose qualifiers can run a command.
    if (line.charAt(position) === '(' && word.isPresent) {
      return makeFailure('zsh glob group');
    }

    if (isWordBoundary(line.charAt(position)) && !isProcessSubstitution(line, position)) {
      break;
    }

    const step = readPart(line, position, word);

    if (typeof step !== 'number') {
      return step;
    }

    position = step;
  }

  return {
    kind: 'word',
    text: word.text,
    isPresent: word.isPresent,
    isPlain: word.isPlain,
    isOpaque: word.isOpaque || isExpandedPattern(word.pattern),
    items: word.items,
    tilde: readTilde(line, start),
    end: position,
  };
}

function isExpandedPattern(pattern: string): boolean {
  return GLOB.test(pattern) || BRACE_EXPANSION.test(pattern) || EQUALS_EXPANSION.test(pattern);
}

function isProcessSubstitution(line: string, position: number): boolean {
  return (line.charAt(position) === '<' || line.charAt(position) === '>') &&
    line.charAt(position + 1) === '(';
}

function readTilde(line: string, start: number): Tilde {
  if (line.charAt(start) !== '~') {
    return 'none';
  }

  const next = line.charAt(start + 1);

  return next === '/' || isWordBoundary(next) ? 'home' : 'user';
}

// Reads one piece of a word; returns the position after it.
function readPart(line: string, position: number, word: Accumulator): number | SplitFailure {
  const char = line.charAt(position);
  const next = line.charAt(position + 1);

  if (char === '\\') {
    if (next === '') {
      return makeFailure('trailing backslash');
    }

    if (next !== '\n') {
      word.text += next;
      word.pattern += QUOTED_PART;
      word.isPresent = true;
    }

    word.isPlain = false;

    return position + 2;
  }

  if (char === "'") {
    const close = line.indexOf("'", position + 1);

    if (close === -1) {
      return makeFailure('unterminated single quote');
    }

    word.text += line.slice(position + 1, close);
    word.pattern += QUOTED_PART;
    word.isPresent = true;
    word.isPlain = false;

    return close + 1;
  }

  if (char === '"') {
    word.isPresent = true;
    word.isPlain = false;
    word.pattern += QUOTED_PART;

    return readDoubleQuoted(line, position + 1, word);
  }

  if (char === '$' && next === "'") {
    word.pattern += QUOTED_PART;

    return readAnsiC(line, position, word);
  }

  if (char === '$' && next === '"') {
    word.isOpaque = true;

    return position + 1;
  }

  const step = readExpansionInto(line, position, word);

  // A step of one character is a literal one; a longer step is an expansion.
  if (typeof step === 'number') {
    word.pattern += step === position + 1 ? char : QUOTED_PART;
  }

  return step;
}

// Reads `$'...'`, which ends at the first `'` that no backslash escapes.
function readAnsiC(line: string, start: number, word: Accumulator): number | SplitFailure {
  let position = start + 2;

  while (position < line.length) {
    if (line.charAt(position) === "'") {
      word.text += line.slice(start, position + 1);
      word.isPresent = true;
      word.isPlain = false;
      word.isOpaque = true;

      return position + 1;
    }

    position += line.charAt(position) === '\\' ? 2 : 1;
  }

  return makeFailure("unterminated $' quote");
}

// Reads an expansion at `position`; any other character is added as it is.
function readExpansionInto(
  line: string,
  position: number,
  word: Accumulator,
): number | SplitFailure {
  const expansion = readExpansion(line, position, {
    ...word.context,
    isInDoubleQuotes: word.isInDoubleQuotes,
  });

  word.isPresent = true;

  if (expansion.kind === 'failure') {
    return expansion;
  }

  if (expansion.kind === 'none') {
    word.text += line.charAt(position);

    return position + 1;
  }

  word.text += line.slice(position, expansion.end);
  word.isOpaque = true;
  word.items.push(...expansion.items);

  return expansion.end;
}

// Reads from just after the opening quote; the result is just after the closing one.
function readDoubleQuoted(
  line: string,
  start: number,
  word: Accumulator,
): number | SplitFailure {
  let position = start;

  word.isInDoubleQuotes = true;

  while (position < line.length) {
    const char = line.charAt(position);
    const next = line.charAt(position + 1);

    if (char === '"') {
      word.isInDoubleQuotes = false;

      return position + 1;
    }

    if (char === '$' || char === '`') {
      const step = readExpansionInto(line, position, word);

      if (typeof step !== 'number') {
        return step;
      }

      position = step;
    } else if (char === '\\' && next === '\n') {
      position += 2;
    } else if (char === '\\' && next !== '' && DOUBLE_QUOTE_ESCAPABLE.includes(next)) {
      word.text += next;
      position += 2;
    } else {
      word.text += char;
      position += 1;
    }
  }

  return makeFailure('unterminated double quote');
}
