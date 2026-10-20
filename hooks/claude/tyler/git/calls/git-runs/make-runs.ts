import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';

// A command string git runs through a shell (`git rebase -x CMD`).
export interface GitCommand {
  readonly kind: 'gitCommand';
  readonly text: string;
}

// Words read again from the top as a command (`git bisect run CMD ARGS`).
export interface Rerun {
  readonly kind: 'rerun';
  readonly words: readonly Word[];
}

export type GitRun = GitCommand | Rerun;

export interface GitRuns {
  readonly kind: 'runs';
  readonly runs: readonly GitRun[];
}

export const NO_RUNS: GitRuns = { kind: 'runs', runs: [] };

const UNREADABLE_COMMAND: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a command run by git the gate cannot read',
  shouldAlwaysDeny: true,
};

// The command strings git runs, each split again; an opaque one cannot be read.
export function makeRuns(commands: readonly Word[]): GitRuns | Unreadable {
  if (commands.some((command) => command.isOpaque)) {
    return UNREADABLE_COMMAND;
  }

  return {
    kind: 'runs',
    runs: commands.map((command) => ({ kind: 'gitCommand', text: command.text })),
  };
}

// The command git runs from words (`git bisect run CMD ARGS`): one word runs through
// the shell and several may run as argv, so the words are read both ways, as a command
// and joined with spaces as a shell string.
export function makeWordRuns(words: readonly Word[]): GitRuns | Unreadable {
  if (words.length === 0) {
    return NO_RUNS;
  }

  const joined = makeRuns([
    {
      text: words.map((word) => word.text).join(' '),
      isOpaque: words.some((word) => word.isOpaque),
      canSplit: false,
    },
  ]);

  return joined.kind === 'unjudgeable'
    ? joined
    : { kind: 'runs', runs: [{ kind: 'rerun', words }, ...joined.runs] };
}
