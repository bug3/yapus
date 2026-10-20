import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { runnerSpecs } from '../runner-specs.ts';
import { type GitRunner, gitRunnerSpecs } from './git-runner-specs.ts';
import { isLongOption } from './is-long-option.ts';
import { type GitRuns, makeRuns } from './make-runs.ts';

const SHORT_GROUP = runnerSpecs.shortGroup;

// The commands of `-x CMD`, `-xCMD`, `-ix CMD`, `LONG CMD` and `LONG=CMD`, where LONG may
// be cut to a prefix.
export function readCommandOptions(
  words: readonly Word[],
  runner: GitRunner,
): GitRuns | Unreadable {
  const commands: Word[] = [];

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const value = word === undefined ? undefined : readCommandValue(word, runner);

    if (value === 'next') {
      index += 1;
      commands.push(...words.slice(index, index + 1));
    } else if (value !== undefined) {
      commands.push(value);
    }
  }

  return makeRuns(commands);
}

// The command a word holds, `next` when it is the next word, or undefined.
function readCommandValue(word: Word, runner: GitRunner): Word | 'next' | undefined {
  const { text } = word;

  if (isLongOption(text, runner.commandLong)) {
    const equals = text.indexOf('=');

    return equals === -1 ? 'next' : { ...word, text: text.slice(equals + 1) };
  }

  if (!SHORT_GROUP.test(text)) {
    return undefined;
  }

  for (let index = 1; index < text.length; index += 1) {
    const letter = text.charAt(index);

    if (letter === gitRunnerSpecs.commandLetter) {
      const rest = text.slice(index + 1);

      return rest === '' ? 'next' : { ...word, text: rest };
    }

    // The rest of the group is this option's value.
    if (runner.valuedLetters.includes(letter)) {
      return undefined;
    }
  }

  return undefined;
}
