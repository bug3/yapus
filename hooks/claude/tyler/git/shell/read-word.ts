import { readExpansion } from './read-expansion.ts';
import type { Context } from './read-substitution.ts';
import type { Item, SplitFailure } from './split-commands.ts';

export type Tilde = 'none' | 'home' | 'user';

// `items` are the commands of the substitutions in the word, to run before it;
// `isOpaque` is true when the word holds an expansion of any kind.
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
  readonly items: Item[];
  readonly context: Context;
}

const BOUNDARIES = ' \t\n&|;()<>';
const DOUBLE_QUOTE_ESCAPABLE = '"\\$`';

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
    items: [],
    context,
  };
  let position = start;

  while (position < line.length) {
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
    isOpaque: word.isOpaque,
    items: word.items,
    tilde: readTilde(line, start),
    end: position,
  };
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
    word.isPresent = true;
    word.isPlain = false;

    return close + 1;
  }

  if (char === '"') {
    word.isPresent = true;
    word.isPlain = false;

    return readDoubleQuoted(line, position + 1, word);
  }

  if (char === '$' && next === "'") {
    return readAnsiC(line, position, word);
  }

  if (char === '$' && next === '"') {
    word.isOpaque = true;

    return position + 1;
  }

  return readExpansionInto(line, position, word);
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
  const expansion = readExpansion(line, position, word.context);

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

  while (position < line.length) {
    const char = line.charAt(position);
    const next = line.charAt(position + 1);

    if (char === '"') {
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
