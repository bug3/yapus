import { readFileSync } from 'node:fs';
import { isRecord } from '../../../../shared/is-record.ts';
import type { Range } from '../git/get-change.ts';

// The range recordReview wrote to path; a missing or malformed file gives
// undefined.
export function readReview(path: string): Range | undefined {
  let payload: unknown;

  try {
    payload = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  const { base, tree } = payload;

  return typeof base === 'string' && typeof tree === 'string' ? { base, tree } : undefined;
}
