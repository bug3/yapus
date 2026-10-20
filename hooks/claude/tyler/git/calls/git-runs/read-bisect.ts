import type { Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { type GitRuns, makeWordRuns, NO_RUNS } from './make-runs.ts';

// `git bisect run CMD ARGS...` runs its words as a command.
export function readBisect(words: readonly Word[]): GitRuns | Unreadable {
  return words[1]?.text === 'run' ? makeWordRuns(words.slice(2)) : NO_RUNS;
}
