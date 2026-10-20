import { makeFailure } from './read-word.ts';
import { type Item, type SplitFailure, splitRegion } from './split-commands.ts';

// `level` counts the substitutions that enclose the text being read.
export interface Context {
  readonly home: string | undefined;
  readonly level: number;
}

// `items` are the commands inside, wrapped in an open and a close; `end` is just past it.
export interface SubstitutionRead {
  readonly kind: 'substitution';
  readonly items: readonly Item[];
  readonly end: number;
}

export interface NoSubstitution {
  readonly kind: 'none';
}

export type SubstitutionResult = SubstitutionRead | NoSubstitution | SplitFailure;

const MAX_LEVEL = 3;
const PAREN_OPENERS = ['$(', '<(', '>('];
const BACKTICK_ESCAPABLE = '`\\$';

// Reads `$(...)`, `<(...)`, `>(...)` or a backtick pair that starts at `start`.
export function readSubstitution(
  line: string,
  start: number,
  context: Context,
): SubstitutionResult {
  const isParen = PAREN_OPENERS.some((opener) => line.startsWith(opener, start));

  if (!isParen && line.charAt(start) !== '`') {
    return { kind: 'none' };
  }

  if (context.level >= MAX_LEVEL) {
    return makeFailure('substitutions nested too deep');
  }

  return isParen ? readParen(line, start, context) : readBacktick(line, start, context);
}

function readParen(line: string, start: number, context: Context): SubstitutionResult {
  const region = splitRegion(line, context.home, {
    start: start + 2,
    depth: context.level + 1,
    isClosedByParen: true,
  });

  if (region.kind === 'failure') {
    return region;
  }

  return wrap(region.items, region.end + 1);
}

function readBacktick(line: string, start: number, context: Context): SubstitutionResult {
  let inside = '';
  let position = start + 1;

  while (line.charAt(position) !== '`') {
    if (position >= line.length) {
      return makeFailure('unclosed backtick');
    }

    const next = line.charAt(position + 1);

    if (line.charAt(position) === '\\' && next !== '' && BACKTICK_ESCAPABLE.includes(next)) {
      inside += next;
      position += 2;
    } else {
      inside += line.charAt(position);
      position += 1;
    }
  }

  const region = splitRegion(inside, context.home, {
    start: 0,
    depth: context.level + 1,
    isClosedByParen: false,
  });

  if (region.kind === 'failure') {
    return region;
  }

  return wrap(region.items, position + 1);
}

function wrap(items: readonly Item[], end: number): SubstitutionRead {
  return { kind: 'substitution', items: [{ kind: 'open' }, ...items, { kind: 'close' }], end };
}
