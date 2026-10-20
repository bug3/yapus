import { type Context, makeFailure, type SplitFailure } from './make-failure.ts';
import { type Heredoc, readHeredoc } from './read-heredoc.ts';
import { readRedirection } from './read-redirection.ts';
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

export type Split = SplitItems | SplitFailure;

// The heredocs opened by one ended command, whose bodies come at the next newline;
// `index` is where its substitutions go, and `command` is the item to hold the bodies,
// if the command had words.
interface PendingCommand {
  readonly heredocs: readonly Heredoc[];
  readonly index: number;
  readonly command: CommandItem | undefined;
}

interface BodiesRead {
  readonly pending: PendingCommand;
  readonly bodies: readonly string[];
  readonly items: readonly Item[];
}

// `closedBy` is `input` for a region that runs to the end of input, and `paren` for
// one that ends at the unquoted `)` that closes it.
export interface Region {
  readonly start: number;
  readonly depth: number;
  readonly closedBy: 'input' | 'paren';
}

export interface RegionItems {
  readonly kind: 'region';
  readonly items: readonly Item[];
  readonly end: number;
}

interface Builder {
  readonly context: Context;
  readonly items: Item[];
  words: Word[];
  heredocs: Heredoc[];
  readonly pending: PendingCommand[];
  isAwaitingTarget: boolean;
  depth: number;
}

// Longest first; `;;` and redirections are tried before these.
const SEPARATORS = ['&&', '||', '|&', '&', '|', ';', '\n'];

export function splitCommands(line: string, home: string | undefined): Split {
  const region = splitRegion(line, home, {
    start: 0,
    depth: 0,
    closedBy: 'input',
  });

  if (region.kind === 'failure') {
    return region;
  }

  return { kind: 'items', items: region.items };
}

// Splits from `start` to the end of input, or, when `closedBy` is `paren`, up to the
// unquoted `)` that closes the region (its position is `end`, the `)` is not consumed).
export function splitRegion(
  line: string,
  home: string | undefined,
  region: Region,
): RegionItems | SplitFailure {
  const builder: Builder = {
    context: { home, level: region.depth },
    items: [],
    words: [],
    heredocs: [],
    pending: [],
    isAwaitingTarget: false,
    depth: 0,
  };
  let position = region.start;

  while (position < line.length) {
    const isClose = region.closedBy === 'paren' && line.charAt(position) === ')';

    if (isClose && builder.depth === 0) {
      break;
    }

    const step = readStep(line, position, builder);

    if (typeof step !== 'number') {
      return step;
    }

    position = step;
  }

  if (region.closedBy === 'paren' && position >= line.length) {
    return makeFailure('unclosed $(');
  }

  const failure = endCommand(builder);

  if (failure !== undefined) {
    return failure;
  }

  if (builder.pending.length > 0) {
    return makeFailure('unterminated heredoc');
  }

  if (builder.depth > 0) {
    return makeFailure('unclosed (');
  }

  return { kind: 'region', items: builder.items, end: position };
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

  const redirection = readRedirection(line, position, builder.context);

  if (redirection.kind === 'failure') {
    return redirection;
  }

  if (redirection.kind === 'heredoc') {
    if (builder.isAwaitingTarget) {
      return makeFailure('redirection without a target');
    }

    builder.heredocs.push(redirection.heredoc);

    return redirection.end;
  }

  if (redirection.kind === 'redirection') {
    if (builder.isAwaitingTarget) {
      return makeFailure('redirection without a target');
    }

    builder.isAwaitingTarget = !redirection.hasTarget;
    builder.items.push(...redirection.items);

    return redirection.end;
  }

  const separator = SEPARATORS.find((candidate) => line.startsWith(candidate, position));

  if (separator !== undefined) {
    const failure = endCommand(builder);

    if (failure !== undefined) {
      return failure;
    }

    const end = position + separator.length;

    return separator === '\n' ? readBodies(line, end, builder) : end;
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
  const read = readWord(line, position, builder.context);

  if (read.kind === 'failure') {
    return read;
  }

  if (!read.isPresent) {
    return read.end;
  }

  builder.items.push(...read.items);

  if (builder.isAwaitingTarget) {
    builder.isAwaitingTarget = false;
  } else if (read.isPlain && read.text === 'case') {
    // A pattern's `)` would close an enclosing `$(` early.
    return makeFailure('case statement');
  } else if (read.isPlain && (read.text === '{' || read.text === '}')) {
    return endCommand(builder) ?? read.end;
  } else if (read.tilde === 'home' && builder.context.home !== undefined && !read.isOpaque) {
    builder.words.push({ text: builder.context.home + read.text.slice(1), isOpaque: false });
  } else {
    builder.words.push({ text: read.text, isOpaque: read.isOpaque || read.tilde !== 'none' });
  }

  return read.end;
}

// Reads the bodies of the heredocs opened on the line just ended, in order.
function readBodies(line: string, start: number, builder: Builder): number | SplitFailure {
  const reads: BodiesRead[] = [];
  let position = start;

  for (const pending of builder.pending.splice(0)) {
    const bodies: string[] = [];
    const items: Item[] = [];

    for (const heredoc of pending.heredocs) {
      const body = readHeredoc(line, position, { heredoc, context: builder.context });

      if (body.kind === 'failure') {
        return body;
      }

      bodies.push(body.text);
      items.push(...body.items);
      position = body.end;
    }

    reads.push({ pending, bodies, items });
  }

  // Substitution commands run before the command that holds the heredoc; attach from
  // the back so that earlier indexes stay valid.
  for (const read of reads.reverse()) {
    const { command, index } = read.pending;

    if (command !== undefined) {
      builder.items[index] = { ...command, heredocs: read.bodies };
    }

    builder.items.splice(index, 0, ...read.items);
  }

  return position;
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

  const command: CommandItem | undefined = builder.words.length > 0
    ? { kind: 'command', words: builder.words, heredocs: [] }
    : undefined;

  if (builder.heredocs.length > 0) {
    builder.pending.push({
      heredocs: builder.heredocs,
      index: builder.items.length,
      command,
    });
  }

  if (command !== undefined) {
    builder.items.push(command);
  }

  builder.heredocs = [];
  builder.words = [];

  return undefined;
}
