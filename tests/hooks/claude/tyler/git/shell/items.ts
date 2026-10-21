import type { Word } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

// Builders for the results `splitCommands` is expected to give; the split tests share them.

export const OPEN = { kind: 'open' };

export const CLOSE = { kind: 'close' };

export function plain(text: string): Word {
  return { text, isOpaque: false, canSplit: false };
}

// An opaque word the shell may split into several words.
export function opaque(text: string): Word {
  return { text, isOpaque: true, canSplit: true };
}

// An opaque word the shell keeps as one word, such as an expansion in double quotes.
export function whole(text: string): Word {
  return { text, isOpaque: true, canSplit: false };
}

export function items(...list: readonly unknown[]): unknown {
  return { kind: 'items', items: list };
}

export function failure(reason: string): unknown {
  return { kind: 'failure', reason };
}

export function item(...texts: readonly string[]): unknown {
  return {
    kind: 'command',
    words: texts.map(plain),
    heredocs: [],
    hasRedirection: false,
    inputTargets: [],
  };
}

// A command that has a redirection, whose target the words do not show.
export function redirected(...texts: readonly string[]): unknown {
  return {
    kind: 'command',
    words: texts.map(plain),
    heredocs: [],
    hasRedirection: true,
    inputTargets: [],
  };
}

export function withBodies(texts: readonly string[], bodies: readonly string[]): unknown {
  return {
    kind: 'command',
    words: texts.map(plain),
    heredocs: bodies,
    hasRedirection: true,
    inputTargets: [],
  };
}

// A result of one command that reads the given files through `<` or `<>`.
export function readingCommand(
  targets: readonly string[],
  ...texts: readonly string[]
): unknown {
  return items({
    kind: 'command',
    words: texts.map(plain),
    heredocs: [],
    hasRedirection: true,
    inputTargets: targets.map(plain),
  });
}

// A result of one command made of plain words.
export function command(...texts: readonly string[]): unknown {
  return items(item(...texts));
}

// A result of one command that has a redirection.
export function redirectedCommand(...texts: readonly string[]): unknown {
  return items(redirected(...texts));
}

// A result of one command made of the given words.
export function commandOf(...words: readonly Word[]): unknown {
  return items({ kind: 'command', words, heredocs: [], hasRedirection: false, inputTargets: [] });
}
