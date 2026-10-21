import { isZeroSha, type PushRecord } from '../get-push-records.ts';
import { runExpecting } from '../branch/run-expecting.ts';
import { isFailure, type Place } from '../branch/run-git.ts';

const PRESENT = 0;
const NOT_A_COMMIT = 1;
const OBJECT_MISSING = 128;
const SHORT_SHA = 12;

// The reason to refuse an update whose remote sha this repository lacks, or
// undefined. The scan lists the commits after that sha, so without it the scan
// would walk the whole history or fail; the person fetches first.
export function getMissingBaseViolation(
  records: readonly PushRecord[],
  place: Place,
): string | undefined {
  const updates = records.filter(
    ({ localSha, remoteSha }) => !isZeroSha(localSha) && !isZeroSha(remoteSha),
  );

  for (const record of updates) {
    const args = ['cat-file', '-e', `${ record.remoteSha }^{commit}`];
    const run = runExpecting(args, [PRESENT, NOT_A_COMMIT, OBJECT_MISSING], place);

    if (isFailure(run)) {
      return `cannot check ${ record.remoteRef } before the scan (${ run.reason }); `
        + 'the push is blocked, retry it';
    }

    if (run.status !== PRESENT) {
      const shortSha = record.remoteSha.slice(0, SHORT_SHA);

      return `${ record.remoteRef } is at ${ shortSha }, which this repository does not have; `
        + 'fetch first, then push';
    }
  }

  return undefined;
}
