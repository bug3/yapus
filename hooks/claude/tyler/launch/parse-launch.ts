import { isSafeId } from '../../../shared/is-safe-id.ts';

export interface Launch {
  readonly sessionId: string;
  // Claude Code sends agent_id only from inside a subagent.
  readonly isNested: boolean;
  readonly subagentType: string;
  readonly description: string;
}

export type Parsed =
  | { readonly kind: 'launch'; readonly launch: Launch }
  | { readonly kind: 'failure'; readonly reason: string };

type Fields = Readonly<Record<string, unknown>>;

// The Agent tool launches general-purpose when subagent_type is left out.
const DEFAULT_TYPE = 'general-purpose';

export function parseLaunch(stdinText: string): Parsed {
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
    agent_id: agentId,
    tool_name: toolName,
    tool_input: toolInput,
  } = payload;

  if (toolName !== 'Agent') {
    return makeFailure('tool_name is not Agent');
  }

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  if (!isRecord(toolInput)) {
    return makeFailure('tool_input is not a JSON object');
  }

  const { subagent_type: subagentType = DEFAULT_TYPE, description } = toolInput;

  if (typeof subagentType !== 'string' || typeof description !== 'string') {
    return makeFailure('tool_input.subagent_type or tool_input.description is not a string');
  }

  const launch = { sessionId, isNested: agentId !== undefined, subagentType, description };

  return { kind: 'launch', launch };
}

function isRecord(parsedJson: unknown): parsedJson is Fields {
  return typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson);
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
