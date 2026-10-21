import { getPushRecords, isZeroSha, type PushLinesViolation } from './get-push-records.ts';

export interface PushCommits {
  readonly commits: string[];
}

// The de-duplicated local shas of the pushed refs. A deletion has an
// all-zero local sha and sends no commit.
export function getPushCommits(stdinText: string): PushCommits | PushLinesViolation {
  const pushRecords = getPushRecords(stdinText);

  if ('violation' in pushRecords) {
    return pushRecords;
  }

  const localShas = pushRecords.records
    .map(({ localSha }) => localSha)
    .filter((sha) => !isZeroSha(sha));

  return { commits: [...new Set(localShas)] };
}
