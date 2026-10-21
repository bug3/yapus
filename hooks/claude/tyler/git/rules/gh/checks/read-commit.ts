import type { Context } from '../../../context/make-context.ts';
import { sizeCatalog } from './size-catalog.ts';
import { getFailureDetail } from './get-failure-detail.ts';

export interface Commit {
  readonly commit: string;
}

export interface MissingCommit {
  readonly isMissing: true;
}

export interface CommitRefusal {
  readonly refusal: string;
}

const { reasons } = sizeCatalog;

// The commit id a name resolves to. Git exits 1 for a name that resolves to nothing,
// which is `isMissing`; any other trouble is a refusal to measure.
export function readCommit(
  context: Context,
  name: string,
): Commit | MissingCommit | CommitRefusal {
  const result = context.run(
    'git',
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ name }^{commit}`],
  );

  if ('failure' in result || result.status > 1) {
    return { refusal: reasons.cannotMeasure(getFailureDetail(result)) };
  }

  return result.status === 1 ? { isMissing: true } : { commit: result.stdout.trim() };
}
