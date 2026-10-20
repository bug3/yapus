import type { Word } from '../../shell/split-commands.ts';

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

// The command strings git runs, each split again. Their words hold no opaque one: a
// subcommand that runs strings refuses any opaque word before reading them.
export function makeRuns(commands: readonly Word[]): GitRuns {
  return {
    kind: 'runs',
    runs: commands.map((command) => ({ kind: 'gitCommand', text: command.text })),
  };
}

// The command git runs from words (`git bisect run CMD ARGS`): one word runs through
// the shell and several may run as argv, so the words are read both ways, as a command
// and joined with spaces as a shell string.
export function makeWordRuns(words: readonly Word[]): GitRuns {
  if (words.length === 0) {
    return NO_RUNS;
  }

  const joined: GitCommand = {
    kind: 'gitCommand',
    text: words.map((word) => word.text).join(' '),
  };

  return { kind: 'runs', runs: [{ kind: 'rerun', words }, joined] };
}
