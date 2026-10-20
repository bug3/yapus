import { makeFailure } from './read-word.ts';
import type { SplitFailure } from './split-commands.ts';

export interface Heredoc {
  readonly delimiter: string;
  readonly isTabStripped: boolean;
}

export interface HeredocBody {
  readonly kind: 'body';
  readonly text: string;
  readonly end: number;
}

export type HeredocResult = HeredocBody | SplitFailure;

// Reads from the start of a line; `end` is just past the delimiter line.
export function readHeredoc(line: string, start: number, heredoc: Heredoc): HeredocResult {
  const lines: string[] = [];
  let position = start;

  while (position < line.length) {
    const found = line.indexOf('\n', position);
    const lineEnd = found === -1 ? line.length : found;
    const raw = line.slice(position, lineEnd);
    const text = heredoc.isTabStripped ? raw.replace(/^\t+/, '') : raw;

    if (text === heredoc.delimiter) {
      return { kind: 'body', text: lines.join('\n'), end: Math.min(lineEnd + 1, line.length) };
    }

    lines.push(text);
    position = lineEnd + 1;
  }

  return makeFailure('unterminated heredoc');
}
