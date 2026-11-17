import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

// What PostToolUse reports for a Write or an Edit: the session and the path
// of the file. A subagent's call carries the main session's id, so the write
// of a subagent counts for the session that launched it.
export interface Write {
  readonly sessionId: string;
  readonly filePath: string;
}

export type Parsed =
  | { readonly kind: 'write'; readonly write: Write }
  | { readonly kind: 'failure'; readonly reason: string };

export function parseWrite(stdinText: string): Parsed {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON');
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object');
  }

  const { session_id: sessionId, tool_input: toolInput } = payload;

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  if (!isRecord(toolInput)) {
    return makeFailure('tool_input is not a JSON object');
  }

  const { file_path: filePath } = toolInput;

  if (typeof filePath !== 'string') {
    return makeFailure('tool_input.file_path is not a string');
  }

  return { kind: 'write', write: { sessionId, filePath } };
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
