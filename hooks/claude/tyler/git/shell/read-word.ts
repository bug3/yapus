import type { SplitFailure } from './split-commands.ts';

export type Tilde = 'none' | 'home' | 'user';

export interface WordRead {
  readonly kind: 'word';
  readonly text: string;
  readonly isPresent: boolean;
  readonly isPlain: boolean;
  readonly tilde: Tilde;
  readonly end: number;
}

export type Read = WordRead | SplitFailure;

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
export function readWord(line: string, start: number): Read {
  let text = '';
  let isPresent = false;
  let isPlain = true;
  let dollarEnd = -1;
  let position = start;

  while (position < line.length && !isWordBoundary(line.charAt(position))) {
    const char = line.charAt(position);

    if (char === '\\') {
      const next = line.charAt(position + 1);

      if (next === '') {
        return makeFailure('trailing backslash');
      }

      if (next !== '\n') {
        text += next;
        isPresent = true;
      }

      isPlain = false;
      position += 2;
    } else if (char === "'") {
      const close = line.indexOf("'", position + 1);

      if (close === -1) {
        return makeFailure('unterminated single quote');
      }

      text += line.slice(position + 1, close);
      isPresent = true;
      isPlain = false;
      position = close + 1;
    } else if (char === '"') {
      const quoted = readDoubleQuoted(line, position + 1);

      if (quoted.kind === 'failure') {
        return quoted;
      }

      text += quoted.text;
      isPresent = true;
      isPlain = false;
      position = quoted.end;
    } else {
      text += char;
      isPresent = true;
      position += 1;

      if (char === '$') {
        dollarEnd = position;
      }
    }
  }

  if (line.charAt(position) === '(' && dollarEnd === position) {
    return makeFailure('substitution not supported yet');
  }

  return { kind: 'word', text, isPresent, isPlain, tilde: readTilde(line, start), end: position };
}

function readTilde(line: string, start: number): Tilde {
  if (line.charAt(start) !== '~') {
    return 'none';
  }

  const next = line.charAt(start + 1);

  return next === '/' || isWordBoundary(next) ? 'home' : 'user';
}

// Reads from just after the opening quote; `end` is just after the closing one.
function readDoubleQuoted(line: string, start: number): Read {
  let text = '';
  let position = start;

  while (position < line.length) {
    const char = line.charAt(position);

    if (char === '"') {
      return {
        kind: 'word',
        text,
        isPresent: true,
        isPlain: false,
        tilde: 'none',
        end: position + 1,
      };
    }

    if (char === '\\') {
      const next = line.charAt(position + 1);

      if (next === '\n') {
        position += 2;
      } else if (next !== '' && DOUBLE_QUOTE_ESCAPABLE.includes(next)) {
        text += next;
        position += 2;
      } else {
        text += char;
        position += 1;
      }
    } else {
      text += char;
      position += 1;
    }
  }

  return makeFailure('unterminated double quote');
}
