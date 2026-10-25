import { isSafeId } from '../../../shared/is-safe-id.ts';

export interface Target {
  readonly dataDir: string;
  readonly sessionId: string;
}

// The data dir and the session id a command program was given, or undefined
// when the data dir is empty or the id is not safe as a file name.
export function getTarget(
  dataDir: string | undefined,
  sessionId: string | undefined,
): Target | undefined {
  return dataDir === undefined || dataDir === '' || !isSafeId(sessionId)
    ? undefined
    : { dataDir, sessionId };
}
