import type { Word } from '../../shell/split-commands.ts';
import { type GitRuns, NO_RUNS } from './make-runs.ts';

// `git bisect run CMD ARGS...` runs its words as a command.
export function readBisect(words: readonly Word[]): GitRuns {
  return words[1]?.text === 'run'
    ? { kind: 'runs', runs: [{ kind: 'rerun', words: words.slice(2) }] }
    : NO_RUNS;
}
