import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
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

// A word that starts with an expansion may be any word: an option, `foreach` or `run`.
const EXPANSION_START = /^[$`]/;

// The commands a git call runs; `words` begin at the subcommand.
export function readGitRuns(words: readonly Word[]): GitRuns | Unreadable {
  const subcommand = words[0]?.text ?? '';
  const runner = gitRunnerSpecs.runners.find((candidate) =>
    candidate.subcommands.includes(subcommand));

  if (runner === undefined) {
    return NO_RUNS;
  }

  return hasUnreadableArgument(words, runner)
    ? UNREADABLE_ARGUMENT
    : HANDLERS[runner.kind](words, runner);
}

// A word the shell may split can expand to an option that runs a command; git reads no
// option after a literal `--`, except in the words of a command string. Where words
// may become a command string, a word that starts with an expansion is not read either.
function hasUnreadableArgument(words: readonly Word[], runner: GitRunner): boolean {
  const end = words.findIndex((word, index) => index > 0 && !word.isOpaque && word.text === '--');
  const options = runner.isRunningStrings || end === -1 ? words.slice(1) : words.slice(1, end);

  return (
    options.some((word) => word.isOpaque && word.canSplit) ||
    (runner.isRunningStrings &&
      words.slice(1).some((word) => word.isOpaque && EXPANSION_START.test(word.text)))
  );
}

function refuseSubcommand(words: readonly Word[], runner: GitRunner): Unreadable {
  return {
    kind: 'unjudgeable',
    reason: `git ${ words[0]?.text ?? '' } ${ runner.refusal }`,
    shouldAlwaysDeny: true,
  };
}
