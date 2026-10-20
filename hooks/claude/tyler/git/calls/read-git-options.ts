import type { Word } from '../shell/split-commands.ts';
import type { Unreadable } from './read-wrapper.ts';
import { wrapperSpecs } from './wrapper-specs.ts';

export interface GitOptions {
  readonly kind: 'options';
  readonly words: readonly Word[];
  readonly configs: readonly Word[];
}

const OPTION_REASON = 'a git option the gate cannot read';
const SUBCOMMAND_REASON = 'a git subcommand the gate cannot read';
const CONFIG_OPTIONS = ['-c', '--config-env'];

// Reads git's global options from `start` (the word after `git`); the words that remain
// begin at the subcommand.
export function readGitOptions(
  words: readonly Word[],
  start: number,
): GitOptions | Unreadable {
  const configs: Word[] = [];
  let index = start;

  for (;;) {
    const word = words[index];

    if (word === undefined) {
      return { kind: 'options', words: [], configs };
    }

    if (!word.text.startsWith('-')) {
      return word.isOpaque
        ? { kind: 'unjudgeable', reason: SUBCOMMAND_REASON, shouldAlwaysDeny: true }
        : { kind: 'options', words: words.slice(index), configs };
    }

    if (isInformation(word.text)) {
      return { kind: 'options', words: [], configs };
    }

    if (wrapperSpecs.gitFlagOptions.includes(word.text)) {
      index += 1;
      continue;
    }

    const value = readValue(words, index);

    if (value === undefined) {
      // The program is git already; what it cannot read is a git call.
      return { kind: 'unjudgeable', reason: OPTION_REASON, shouldAlwaysDeny: true };
    }

    if (CONFIG_OPTIONS.includes(value.name)) {
      configs.push(value.word);
    }

    index += value.length;
  }
}

// `git --version` and its like print and exit; the words after them are not a subcommand.
function isInformation(text: string): boolean {
  return wrapperSpecs.gitInformationOptions.some((option) =>
    option.endsWith('=') ? text.startsWith(option) : text === option);
}

interface OptionValue {
  readonly name: string;
  readonly word: Word;
  readonly length: number;
}

// The value of a valued option written as `-C v` or `--name v` or `--name=v`.
function readValue(
  words: readonly Word[],
  index: number,
): OptionValue | undefined {
  const text = words[index]?.text ?? '';
  const separate = words[index + 1];
  const name = wrapperSpecs.gitValuedOptions.find(
    (candidate) => candidate === text || text.startsWith(`${ candidate }=`),
  );

  if (name === undefined) {
    return undefined;
  }

  const word =
    text === name
      ? separate
      : {
        text: text.slice(name.length + 1),
        isOpaque: words[index]?.isOpaque === true,
        canSplit: words[index]?.canSplit === true,
      };

  // An unquoted opaque value can expand to several words and hide the subcommand.
  if (word === undefined || word.isOpaque) {
    return undefined;
  }

  return { name, word, length: text === name ? 2 : 1 };
}
