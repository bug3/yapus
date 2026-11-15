import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';
import { readMode } from '../settings/read-mode.ts';

// Whether the session in the SessionStart payload is switched off. Anything
// the hook cannot read is not off, so the policy is injected: a guardrail
// fails toward the rules.
export function isSessionOff(stdinText: string | undefined, dataDir: string | undefined): boolean {
  if (stdinText === undefined || dataDir === undefined || dataDir === '') {
    return false;
  }

  const sessionId = getSessionId(stdinText);

  if (sessionId === undefined) {
    return false;
  }

  const mode = readMode(dataDir, sessionId);

  return mode.kind === 'value' && mode.value === 'off';
}

function getSessionId(stdinText: string): string | undefined {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return undefined;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  return isSafeId(payload.session_id) ? payload.session_id : undefined;
}
