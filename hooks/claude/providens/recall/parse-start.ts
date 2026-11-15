import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

// What SessionStart reports: the session and why it started.
export interface Start {
  readonly sessionId: string;
  readonly source: string;
}

export type Parsed =
  | { readonly kind: 'start'; readonly start: Start }
  | { readonly kind: 'failure'; readonly reason: string };

export function parseStart(stdinText: string): Parsed {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON');
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object');
  }

  const { session_id: sessionId, source } = payload;

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  if (typeof source !== 'string') {
    return makeFailure('source is not a string');
  }

  return { kind: 'start', start: { sessionId, source } };
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
