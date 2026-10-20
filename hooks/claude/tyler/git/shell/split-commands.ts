import { readWord } from './read-word.ts';

export interface Word {
  readonly text: string;
  readonly isOpaque: boolean;
}

export interface CommandItem {
  readonly kind: 'command';
  readonly words: readonly Word[];
  readonly heredocs: readonly string[];
}

export interface OpenItem {
  readonly kind: 'open';
}

export interface CloseItem {
  readonly kind: 'close';
}

export type Item = CommandItem | OpenItem | CloseItem;

export interface SplitItems {
  readonly kind: 'items';
  readonly items: readonly Item[];
}

export interface SplitFailure {
  readonly kind: 'failure';
  readonly reason: string;
}

export type Split = SplitItems | SplitFailure;

const BLANKS = ' \t\n';

export function splitCommands(line: string): Split {
  const words: Word[] = [];
  let position = 0;

  while (position < line.length) {
    if (BLANKS.includes(line.charAt(position))) {
      position += 1;
      continue;
    }

    const read = readWord(line, position);

    if (read.kind === 'failure') {
      return read;
    }

    if (read.isPresent) {
      words.push({ text: read.text, isOpaque: false });
    }

    position = read.end;
  }

  if (words.length === 0) {
    return { kind: 'items', items: [] };
  }

  return { kind: 'items', items: [{ kind: 'command', words, heredocs: [] }] };
}
