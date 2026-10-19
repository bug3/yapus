import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

export interface HookInput {
  readonly sessionId: string;
  readonly cwd: string;
  readonly event: string;
  // Claude Code sends agent_id only from inside a subagent.
  readonly agentId?: string;
  readonly message?: string;
  // Claude Code sets stop_hook_active when a stop hook already sent the
  // session back once.
  readonly isRetry: boolean;
}

export type ParsedInput =
  | { readonly kind: 'input'; readonly input: HookInput }
  | { readonly kind: 'failure'; readonly reason: string; readonly isRetry: boolean };

export function parseHookInput(stdinText: string): ParsedInput {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON', false);
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object', false);
  }

  const {
    session_id: sessionId,
    cwd,
    hook_event_name: event,
    agent_id: agentId,
    last_assistant_message: message,
    stop_hook_active: isRetry = false,
  } = payload;

  const isRetryRequested = isRetry === true;

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens', isRetryRequested);
  }

  if (!isFilled(cwd) || !isFilled(event)) {
    return makeFailure('cwd or hook_event_name is missing', isRetryRequested);
  }

  if (typeof isRetry !== 'boolean') {
    return makeFailure('stop_hook_active is not a boolean', false);
  }

  const input: HookInput = {
    sessionId,
    cwd,
    event,
    ...(isFilled(agentId) && { agentId }),
    ...(typeof message === 'string' && { message }),
    isRetry,
  };

  return { kind: 'input', input };
}

function isFilled(field: unknown): field is string {
  return typeof field === 'string' && field !== '';
}

function makeFailure(reason: string, isRetry: boolean): ParsedInput {
  return { kind: 'failure', reason, isRetry };
}
