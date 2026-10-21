import type { Word } from '../shell/split-commands.ts';

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u;
// Words that may stand before the program word without being it: shell
// keywords and prefixes that run the program that follows.
const PREFIXES: readonly string[] = ['!', 'then', 'else', 'do', 'time', 'command', 'env'];

// The words of a command after the `NAME=value` words and the prefix words
// (`!`, `then`, `else`, `do`, `time`, `command`, `env`) that lead it.
export function skipLeadWords(words: readonly Word[]): readonly Word[] {
  const start = words.findIndex(({ text }) => !ASSIGNMENT.test(text) && !PREFIXES.includes(text));

  return start < 0 ? [] : words.slice(start);
}
