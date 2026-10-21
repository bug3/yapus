import type { Context } from '../../../context/make-context.ts';
import { readCommit, type CommitRefusal } from './read-commit.ts';
import { sizeCatalog } from './size-catalog.ts';

export interface BaseCommit {
  readonly commit: string;
}

// The commit of the `--base` branch on origin, or a refusal when origin's copy of it
// is not fetched. The base is always given: gh's own default is never guessed.
export function findBase(context: Context, base: string): BaseCommit | CommitRefusal {
  const name = `${ sizeCatalog.remote }${ base }`;
  const found = readCommit(context, name);

  return 'isMissing' in found ? { refusal: sizeCatalog.reasons.fetchFirst(name) } : found;
}
