import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { runnerSpecs } from '../runner-specs.ts';
import type { GitRunner } from './git-runner-specs.ts';
import { isLongOption } from './is-long-option.ts';
import { type GitRuns, NO_RUNS } from './make-runs.ts';

const SHORT_GROUP = runnerSpecs.shortGroup;

// An option that runs a command git takes as a program path or a shell string
// (`git push --receive-pack CMD`), which the gate does not split.
export function refuseOptions(words: readonly Word[], runner: GitRunner): GitRuns | Unreadable {
  const isRefused = words.slice(1).some(
    ({ text }) =>
      runner.refusedLongs.some((long) => isLongOption(text, long)) ||
      (SHORT_GROUP.test(text) && runner.refusedLetters.some((letter) => text.includes(letter))),
  );

  return isRefused
    ? {
      kind: 'unjudgeable',
      reason: `git ${ words[0]?.text ?? '' } runs a command the gate cannot read`,
      shouldAlwaysDeny: true,
    }
    : NO_RUNS;
}
