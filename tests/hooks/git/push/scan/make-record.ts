import type { PushRecord } from '../../../../../hooks/git/push/get-push-records.ts';

export const ZEROS = '0'.repeat(40);

// A push record for a branch: a local sha going to a remote ref that holds
// the remote sha, ZEROS for a new ref.
export function makeRecord(localSha: string, remoteSha: string, ref = 'refs/heads/x'): PushRecord {
  return { localRef: ref, localSha, remoteRef: ref, remoteSha };
}
