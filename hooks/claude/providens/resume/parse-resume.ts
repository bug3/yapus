import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

// What SendMessage reports when it woke a subagent that had stopped.
export interface Resume {
  readonly sessionId: string;
  readonly agentId: string;
  readonly toolUseId: string;
}

// 'none' is a message that resumed nothing. A resume carries resumedAgentId;
// a message queued to a running agent does not.
export type Parsed =
  | { readonly kind: 'resume'; readonly resume: Resume }
  | { readonly kind: 'none' }
  | { readonly kind: 'failure'; readonly reason: string };

export function parseResume(stdinText: string): Parsed {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON');
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object');
  }

  const {
    session_id: sessionId,
    tool_name: toolName,
    tool_use_id: toolUseId,
    tool_response: response,
  } = payload;

  if (toolName !== 'SendMessage') {
    return makeFailure('tool_name is not SendMessage');
  }

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  if (!isRecord(response)) {
    return makeFailure('tool_response is not a JSON object');
  }

  if (typeof toolUseId !== 'string') {
    return makeFailure('tool_use_id is not a string');
  }

  const { resumedAgentId: agentId } = response;

  if (agentId === undefined) {
    return { kind: 'none' };
  }

  if (!isSafeId(agentId)) {
    return makeFailure('tool_response.resumedAgentId is not letters, digits and hyphens');
  }

  return { kind: 'resume', resume: { sessionId, agentId, toolUseId } };
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
