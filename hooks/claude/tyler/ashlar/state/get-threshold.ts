import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Changed lines a change may have before it needs review (ledger, ashlar B2).
export const DEFAULT_THRESHOLD = 150;

export type Threshold =
  | { readonly kind: 'threshold'; readonly lines: number }
  | { readonly kind: 'failure'; readonly reason: string };

const THRESHOLD_FILE = 'review-threshold';
const WHOLE_NUMBER = /^\d+$/;

// The line threshold: the whole number the person wrote in
// <dataDir>/review-threshold, or DEFAULT_THRESHOLD when there is no such file.
// A file that holds no whole number comes back as a failure.
export function getThreshold(dataDir: string): Threshold {
  const path = join(dataDir, THRESHOLD_FILE);

  if (!existsSync(path)) {
    return { kind: 'threshold', lines: DEFAULT_THRESHOLD };
  }

  const text = readFileSync(path, 'utf8').trim();

  if (!WHOLE_NUMBER.test(text)) {
    return {
      kind: 'failure',
      reason: `${ path } holds no whole number; the person writes one there, such as 150`,
    };
  }

  return { kind: 'threshold', lines: Number(text) };
}
