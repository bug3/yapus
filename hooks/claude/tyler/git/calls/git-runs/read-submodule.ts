import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { gitRunnerSpecs } from './git-runner-specs.ts';
import { type GitRuns, makeWordRuns, NO_RUNS } from './make-runs.ts';

const FOREACH_OPTION: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a git submodule foreach option the gate cannot read',
  shouldAlwaysDeny: true,
};

// `git submodule [OPTIONS] foreach [--recursive] [--quiet] [--] CMD...` runs its words.
export function readSubmodule(words: readonly Word[]): GitRuns | Unreadable {
  let index = 1;

  while (words[index]?.text.startsWith('-') === true) {
    index += 1;
  }

  if (words[index]?.text !== 'foreach') {
    return NO_RUNS;
  }

  index += 1;

  for (;;) {
    const text = words[index]?.text ?? '';

    if (text === '--') {
      index += 1;
      break;
    }

    if (!text.startsWith('-')) {
      break;
    }

    // Another option may take the next word as its value and hide the command.
    if (!gitRunnerSpecs.foreachOptions.includes(text)) {
      return FOREACH_OPTION;
    }

    index += 1;
  }

  return makeWordRuns(words.slice(index));
}
