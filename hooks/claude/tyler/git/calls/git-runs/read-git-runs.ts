import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { findOptionsEnd } from './find-options-end.ts';
import { type GitRunner, type GitRunnerKind, gitRunnerSpecs } from './git-runner-specs.ts';
import type { GitRuns } from './make-runs.ts';
import { NO_RUNS } from './make-runs.ts';
import { readBisect } from './read-bisect.ts';
import { readCommandOptions } from './read-command-options.ts';
import { readSubmodule } from './read-submodule.ts';
import { refuseOptions } from './refuse-options.ts';

type Handler = (words: readonly Word[], runner: GitRunner) => GitRuns | Unreadable;

const HANDLERS = {
  commandOptions: readCommandOptions,
  submodule: readSubmodule,
  bisect: readBisect,
  refusedOptions: refuseOptions,
  refused: refuseSubcommand,
} satisfies Record<GitRunnerKind, Handler>;

const UNREADABLE_ARGUMENT: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a git argument the gate cannot read may run a command',
  shouldAlwaysDeny: true,
};

// The commands a git call runs; `words` begin at the subcommand.
export function readGitRuns(words: readonly Word[]): GitRuns | Unreadable {
  const subcommand = words[0]?.text ?? '';
  const runner = gitRunnerSpecs.runners.find((candidate) =>
    candidate.subcommands.includes(subcommand));

  if (runner === undefined) {
    return NO_RUNS;
  }

  return readUnreadableArgument(words, runner) ?? HANDLERS[runner.kind](words, runner);
}

// Where words may become a command string, any opaque word may be one, or an option,
// `foreach` or `run`. Elsewhere a word the shell may split can expand to an option
// that runs a command; git reads no option after a literal `--`.
function readUnreadableArgument(
  words: readonly Word[],
  runner: GitRunner,
): Unreadable | undefined {
  if (runner.isRunningStrings) {
    return words.slice(1).some((word) => word.isOpaque)
      ? {
        kind: 'unjudgeable',
        reason: `cannot judge \`git ${ words[0]?.text ?? '' }\` with an argument that may `
          + 'run a command; write it literally',
        shouldAlwaysDeny: true,
      }
      : undefined;
  }

  const options = words.slice(1, findOptionsEnd(words));

  return options.some((word) => word.isOpaque && word.canSplit) ? UNREADABLE_ARGUMENT : undefined;
}

function refuseSubcommand(words: readonly Word[], runner: GitRunner): Unreadable {
  return {
    kind: 'unjudgeable',
    reason: `git ${ words[0]?.text ?? '' } ${ runner.refusal }`,
    shouldAlwaysDeny: true,
  };
}
