import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

export interface Stop {
  readonly sessionId: string;
  readonly agentType: string;
  readonly message: string;
  // Claude Code sets stop_hook_active when a stop hook already sent the
  // subagent back once.
  readonly isRetry: boolean;
  // The id that names the subagent's transcript and meta file; undefined
  // when the payload lacks it.
  readonly agentId: string | undefined;
  // The path of the subagent's transcript, a JSONL file; undefined when the
  // payload lacks it.
  readonly transcriptPath: string | undefined;
}

export type Parsed =
  | { readonly kind: 'stop'; readonly stop: Stop }
  | { readonly kind: 'failure'; readonly reason: string };

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
    agent_id: agentId,
    agent_transcript_path: transcriptPath,
  } = payload;

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  const hasFields = typeof agentType === 'string' && typeof message === 'string';

  if (!hasFields || typeof isRetry !== 'boolean') {
    return makeFailure('agent_type, last_assistant_message or stop_hook_active is missing');
  }

  return {
    kind: 'stop',
    stop: {
      sessionId,
      agentType,
      message,
      isRetry,
      agentId: typeof agentId === 'string' ? agentId : undefined,
      transcriptPath: typeof transcriptPath === 'string' ? transcriptPath : undefined,
    },
  };
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
