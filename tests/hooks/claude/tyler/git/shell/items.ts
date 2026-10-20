import type { Word } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

// Builders for the results `splitCommands` is expected to give; the split tests share them.

export const OPEN = { kind: 'open' };

export const CLOSE = { kind: 'close' };

export function plain(text: string): Word {
  return { text, isOpaque: false };
}

export function opaque(text: string): Word {
  return { text, isOpaque: true };
}

export function items(...list: readonly unknown[]): unknown {
  return { kind: 'items', items: list };
}

export function failure(reason: string): unknown {
  return { kind: 'failure', reason };
}

export function item(...texts: readonly string[]): unknown {
  return { kind: 'command', words: texts.map(plain), heredocs: [] };
}

export function withBodies(texts: readonly string[], bodies: readonly string[]): unknown {
  return { kind: 'command', words: texts.map(plain), heredocs: bodies };
}

// A result of one command made of plain words.
export function command(...texts: readonly string[]): unknown {
  return items(item(...texts));
}

// A result of one command made of the given words.
export function commandOf(...words: readonly Word[]): unknown {
  return items({ kind: 'command', words, heredocs: [] });
}

// A result of one command made of one opaque word.
export function opaqueCommand(text: string): unknown {
  return commandOf(opaque(text));
}
