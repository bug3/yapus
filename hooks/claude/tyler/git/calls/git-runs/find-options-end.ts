import type { Word } from '../../shell/split-commands.ts';

// The index of the literal `--` after which git reads no option, or the number of words
// when there is none; `words` begin at the subcommand. A `--` after a word that starts
// with `-` may be that option's value (`git grep -e --`), and so may one after an opaque
// word, which may be such an option; either ends nothing.
export function findOptionsEnd(words: readonly Word[]): number {
  const end = words.findIndex((word, index) => {
    const before = words[index - 1];

    return index > 0
      && !word.isOpaque
      && word.text === '--'
      && before?.isOpaque === false
      && !before.text.startsWith('-');
  });

  return end === -1 ? words.length : end;
}
