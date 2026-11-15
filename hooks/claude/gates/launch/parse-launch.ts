import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

// The subagent that called the Agent tool; agentType is undefined when the
// payload names no type.
export interface Caller {
  readonly agentType: string | undefined;
}

export interface Launch {
  readonly sessionId: string;
  // Claude Code sends agent_id only from inside a subagent; undefined for a
  // launch from the main session.
  readonly caller: Caller | undefined;
  readonly subagentType: string;
  readonly description: string;
  // The keys and settings the record keeps; undefined when the payload
  // lacks them.
  readonly toolUseId: string | undefined;
  readonly promptId: string | undefined;
  readonly model: string | undefined;
  readonly effort: string | undefined;
}

export type Parsed =
  | { readonly kind: 'launch'; readonly launch: Launch }
  | { readonly kind: 'failure'; readonly reason: string };

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
    agent_type: agentType,
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: toolUseId,
    prompt_id: promptId,
    effort,
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

  const { subagent_type: subagentType = DEFAULT_TYPE, description, model } = toolInput;

  if (typeof subagentType !== 'string' || typeof description !== 'string') {
    return makeFailure('tool_input.subagent_type or tool_input.description is not a string');
  }

  const launch: Launch = {
    sessionId,
    caller: agentId === undefined ? undefined : { agentType: getString(agentType) },
    subagentType,
    description,
    toolUseId: getString(toolUseId),
    promptId: getString(promptId),
    model: getString(model),
    effort: isRecord(effort) ? getString(effort.level) : undefined,
  };

  return { kind: 'launch', launch };
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
