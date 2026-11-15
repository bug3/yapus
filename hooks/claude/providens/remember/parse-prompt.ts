import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

// What UserPromptSubmit reports: the session and the text that was submitted.
export interface Prompt {
  readonly sessionId: string;
  readonly text: string;
}

export type Parsed =
  | { readonly kind: 'prompt'; readonly prompt: Prompt }
  | { readonly kind: 'failure'; readonly reason: string };

export function parsePrompt(stdinText: string): Parsed {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON');
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object');
  }

  const { session_id: sessionId, prompt } = payload;

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  if (typeof prompt !== 'string') {
    return makeFailure('prompt is not a string');
  }

  return { kind: 'prompt', prompt: { sessionId, text: prompt } };
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
