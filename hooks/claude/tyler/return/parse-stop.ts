export interface Stop {
  readonly sessionId: string;
  readonly agentType: string;
  readonly message: string;
  // Claude Code sets stop_hook_active when a stop hook already sent the
  // subagent back once.
  readonly isRetry: boolean;
}

export type Parsed =
  | { readonly kind: 'stop'; readonly stop: Stop }
  | { readonly kind: 'failure'; readonly reason: string };

type Fields = Readonly<Record<string, unknown>>;

// The session id names nothing on disk here, but the decision log keys on
// it, so it is held to the launch hook's form.
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/;

export function parseStop(stdinText: string): Parsed {
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
    agent_type: agentType,
    last_assistant_message: message,
    stop_hook_active: isRetry = false,
  } = payload;

  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  const hasFields = typeof agentType === 'string' && typeof message === 'string';

  if (!hasFields || typeof isRetry !== 'boolean') {
    return makeFailure('agent_type, last_assistant_message or stop_hook_active is missing');
  }

  return { kind: 'stop', stop: { sessionId, agentType, message, isRetry } };
}

function isRecord(parsedJson: unknown): parsedJson is Fields {
  return typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson);
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
