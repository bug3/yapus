import type { Word } from '../../shell/split-commands.ts';
import { isUnreadable } from '../get-unreadable-reason.ts';
import { hasFlag, readArguments } from '../read-arguments.ts';
import { branchCatalog } from './branch-catalog.ts';

// What a git call names as a new branch: a word, nothing, or a call the gate
// cannot read because a creating option has no value.
export type CreatedBranch = Word | 'none' | 'unreadable';

// `words` start at the subcommand.
export function readCreatedBranch(words: readonly Word[]): CreatedBranch {
  const creator = branchCatalog.creators.find(({ leading }) =>
    leading.every((text, index) => words[index]?.text === text));

  if (creator !== undefined) {
    const rest = words.slice(creator.leading.length);

    return rest.some(isUnreadable)
      ? 'unreadable'
      : readOptionValue(rest, creator.letters, creator.longs);
  }

  if (words[0]?.text !== 'branch') {
    return 'none';
  }

  // A word the shell may split, or one that starts with - or +, may be an option.
  return words.slice(1).some(isUnreadable) ? 'unreadable' : readBranchName(words.slice(1));
}

function readOptionValue(
  words: readonly Word[],
  letters: string,
  longs: readonly string[],
): CreatedBranch {
  for (const [index, word] of words.entries()) {
    const { text } = word;

    if (text === '--') {
      return 'none';
    }

    if (!word.isOpaque && text.startsWith('--')) {
      const [name = '', ...value] = text.split('=');
      const isCreating = name.length > 2 && longs.some((long) => long.startsWith(name));

      if (isCreating) {
        return value.length > 0
          ? { ...word, text: value.join('=') }
          : words[index + 1] ?? 'unreadable';
      }
    } else if (!word.isOpaque && text.startsWith('-')) {
      const at = text.slice(1).search(new RegExp(`[${ letters }]`));

      if (at >= 0) {
        const attached = text.slice(at + 2);

        return attached === '' ? words[index + 1] ?? 'unreadable' : { ...word, text: attached };
      }
    }
  }

  return 'none';
}

// `git branch <name> [<start>]` creates; a rename or copy names its last operand.
function readBranchName(words: readonly Word[]): CreatedBranch {
  const args = readArguments(words.map(({ text }) => text));
  const has = (flags: readonly string[]): boolean => flags.some((flag) => hasFlag(args, flag));
  const isRename = has(branchCatalog.branchRenames);

  if (!isRename && has(branchCatalog.branchOtherModes)) {
    return 'none';
  }

  const operands = words.filter(({ text }) => args.operands.includes(text));
  const named = isRename ? operands.at(-1) : operands[0];

  return named ?? 'none';
}
