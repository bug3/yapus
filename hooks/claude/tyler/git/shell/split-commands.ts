import { readRedirection } from './read-redirection.ts';
import { makeFailure, readWord } from './read-word.ts';

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

interface Builder {
  readonly home: string | undefined;
  readonly items: Item[];
  words: Word[];
  isAwaitingTarget: boolean;
  depth: number;
}

// Longest first; `;;` and redirections are tried before these.
const SEPARATORS = ['&&', '||', '|&', '&', '|', ';', '\n'];

export function splitCommands(line: string, home: string | undefined): Split {
  const builder: Builder = { home, items: [], words: [], isAwaitingTarget: false, depth: 0 };
  let position = 0;

  while (position < line.length) {
    const step = readStep(line, position, builder);

    if (typeof step !== 'number') {
      return step;
    }

    position = step;
  }

  const failure = endCommand(builder);

  if (failure !== undefined) {
    return failure;
  }

  if (builder.depth > 0) {
    return makeFailure('unclosed (');
  }

  return { kind: 'items', items: builder.items };
}

// Returns the position after what it consumed.
function readStep(
  line: string,
  position: number,
  builder: Builder,
): number | SplitFailure {
  const char = line.charAt(position);

  if (char === ' ' || char === '\t') {
    return position + 1;
  }

  if (char === '#') {
    const newline = line.indexOf('\n', position);

    return newline === -1 ? line.length : newline;
  }

  if (line.startsWith(';;', position)) {
    return makeFailure('case statement');
  }

  const redirection = readRedirection(line, position);

  if (redirection.kind === 'failure') {
    return redirection;
  }

  if (redirection.kind === 'redirection') {
    if (builder.isAwaitingTarget) {
      return makeFailure('redirection without a target');
    }

    builder.isAwaitingTarget = !redirection.hasTarget;

    return redirection.end;
  }

  const separator = SEPARATORS.find((candidate) => line.startsWith(candidate, position));

  if (separator !== undefined) {
    return endCommand(builder) ?? position + separator.length;
  }

  if (char === '(' || char === ')') {
    return readScope(char, builder) ?? position + 1;
  }

  return readCommandWord(line, position, builder);
}

function readCommandWord(
  line: string,
  position: number,
  builder: Builder,
): number | SplitFailure {
  const read = readWord(line, position);

  if (read.kind === 'failure') {
    return read;
  }

  if (!read.isPresent) {
    return read.end;
  }

  if (builder.isAwaitingTarget) {
    builder.isAwaitingTarget = false;
  } else if (read.isPlain && (read.text === '{' || read.text === '}')) {
    return endCommand(builder) ?? read.end;
  } else if (read.tilde === 'home' && builder.home !== undefined) {
    builder.words.push({ text: builder.home + read.text.slice(1), isOpaque: false });
  } else {
    builder.words.push({ text: read.text, isOpaque: read.tilde !== 'none' });
  }

  return read.end;
}

function readScope(char: string, builder: Builder): SplitFailure | undefined {
  const failure = endCommand(builder);

  if (failure !== undefined) {
    return failure;
  }

  if (char === '(') {
    builder.items.push({ kind: 'open' });
    builder.depth += 1;

    return undefined;
  }

  if (builder.depth === 0) {
    return makeFailure('unmatched )');
  }

  builder.items.push({ kind: 'close' });
  builder.depth -= 1;

  return undefined;
}

function endCommand(builder: Builder): SplitFailure | undefined {
  if (builder.isAwaitingTarget) {
    return makeFailure('redirection without a target');
  }

  if (builder.words.length > 0) {
    builder.items.push({ kind: 'command', words: builder.words, heredocs: [] });
    builder.words = [];
  }

  return undefined;
}
