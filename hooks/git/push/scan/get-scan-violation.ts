import { getScanVerdict } from '../../../shared/scanner/get-scan-verdict.ts';
import { runScanner } from '../../../shared/scanner/run-scanner.ts';
import type { Place } from '../branch/run-git.ts';
import type { PushRecord } from '../get-push-records.ts';
import { getMissingBaseViolation } from './get-missing-base-violation.ts';
import { getScanRanges } from './get-scan-ranges.ts';

export interface ScanQuery {
  // Where the scan and the git calls before it run.
  readonly place: Place;
  // The remote the push goes to: its name or, for a URL push, the URL.
  readonly remote: string;
  // Says a line to the person while the push goes on.
  readonly warn: (line: string) => void;
}

// The reason to refuse a push whose outgoing commits hold a secret or cannot
// be scanned, or undefined. One scan covers every record. A scanner that is
// not installed only warns.
export async function getScanViolation(
  records: readonly PushRecord[],
  { place, remote, warn }: ScanQuery,
): Promise<string | undefined> {
  const ranges = getScanRanges(records, remote);

  if (ranges.length === 0) {
    return undefined;
  }

  const baseViolation = getMissingBaseViolation(records, place);

  if (baseViolation !== undefined) {
    return baseViolation;
  }

  const outcome = await runScanner({
    subcommand: ['git', `--log-opts=${ ranges.join(' ') }`],
    cwd: place.cwd,
    env: place.env,
  });
  const verdict = getScanVerdict(outcome, 'the outgoing change');

  verdict.warnings.forEach(warn);

  return verdict.violations.length === 0 ? undefined : verdict.violations.join('; ');
}
