import type { Word } from '../../shell/split-commands.ts';

// The index of the literal `--` after which git reads no option, or the number of words
// when there is none; `words` begin at the subcommand. A `--` after a word that starts
// with `-` may be that option's value (`git grep -e --`), so it ends nothing.
export function findOptionsEnd(words: readonly Word[]): number {
  const end = words.findIndex((word, index) =>
    index > 0
    && !word.isOpaque
    && word.text === '--'
    && words[index - 1]?.text.startsWith('-') !== true);

  return end === -1 ? words.length : end;
}
