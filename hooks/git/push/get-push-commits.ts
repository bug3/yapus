import { getPushRecords, type PushLinesViolation } from './get-push-records.ts';

const ZEROS = /^0+$/;

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
    .filter((sha) => !ZEROS.test(sha));

  return { commits: [...new Set(localShas)] };
}
