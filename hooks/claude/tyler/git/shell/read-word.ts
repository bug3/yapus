import type { SplitFailure } from './split-commands.ts';

interface WordRead {
  readonly kind: 'word';
  readonly text: string;
  readonly isPresent: boolean;
  readonly end: number;
}

type Read = WordRead | SplitFailure;

const BLANKS = ' \t\n';
const DOUBLE_QUOTE_ESCAPABLE = '"\\$`';

export function readWord(line: string, start: number): Read {
  let text = '';
  let isPresent = false;
  let position = start;

  while (position < line.length && !BLANKS.includes(line.charAt(position))) {
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

      position += 2;
    } else if (char === "'") {
      const close = line.indexOf("'", position + 1);

      if (close === -1) {
        return makeFailure('unterminated single quote');
      }

      text += line.slice(position + 1, close);
      isPresent = true;
      position = close + 1;
    } else if (char === '"') {
      const quoted = readDoubleQuoted(line, position + 1);

      if (quoted.kind === 'failure') {
        return quoted;
      }

      text += quoted.text;
      isPresent = true;
      position = quoted.end;
    } else {
      text += char;
      isPresent = true;
      position += 1;
    }
  }

  return { kind: 'word', text, isPresent, end: position };
}

// Reads from just after the opening quote; `end` is just after the closing one.
function readDoubleQuoted(line: string, start: number): Read {
  let text = '';
  let position = start;

  while (position < line.length) {
    const char = line.charAt(position);

    if (char === '"') {
      return { kind: 'word', text, isPresent: true, end: position + 1 };
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

function makeFailure(reason: string): SplitFailure {
  return { kind: 'failure', reason };
}
