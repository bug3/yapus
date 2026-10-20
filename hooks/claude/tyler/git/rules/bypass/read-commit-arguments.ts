import type { Word } from '../../shell/split-commands.ts';
import { bypassCatalog } from './bypass-catalog.ts';
import type { Arguments } from '../read-arguments.ts';

// Like `readArguments`, but knows which `git commit` options take a value, so a
// value (`-m -n`, `-mn`) is never read as a flag. An opaque word is a value only
// right after a value-taking option; anywhere else it could be any option.
export interface CommitArguments extends Arguments {
  readonly hasStrayOpaque: boolean;
}

export function readCommitArguments(words: readonly Word[]): CommitArguments {
  const flags = new Set<string>();
  const operands: string[] = [];
  let isAfterDashes = false;
  let isValuePending = false;
  let hasStrayOpaque = false;

  for (const { text, isOpaque } of words) {
    if (isValuePending) {
      isValuePending = false;
    } else if (isOpaque) {
      hasStrayOpaque = true;
    } else if (isAfterDashes || !text.startsWith('-') || text === '-') {
      operands.push(text);
    } else if (text === '--') {
      isAfterDashes = true;
    } else if (text.startsWith('--')) {
      flags.add(text);
      isValuePending = takesValue(text);
    } else {
      isValuePending = readGroup(text, flags);
    }
  }

  return { flags, operands, hasStrayOpaque };
}

// Adds the letters of a short group up to a value-taking one; true when that
// letter ends the group, so the next word is its value.
function readGroup(text: string, flags: Set<string>): boolean {
  const letters = text.slice(1);
  let count = 0;

  for (const letter of letters) {
    count += 1;

    if (bypassCatalog.commitValueLetters.includes(letter)) {
      return count === letters.length;
    }

    flags.add(`-${ letter }`);
  }

  return false;
}

// git accepts any unambiguous prefix of a long option, as for `hasFlag`.
function takesValue(text: string): boolean {
  return text.length > 2
    && bypassCatalog.commitValueOptions.some((option) => option.startsWith(text));
}
