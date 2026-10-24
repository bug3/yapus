import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';

// What the Agent tool reports when a launch ends: at once for a background
// launch (status async_launched, no totals), at the subagent's end otherwise
// (status completed, with the totals and the text it returned).
export interface End {
  readonly sessionId: string;
  readonly promptId: string | undefined;
  readonly toolUseId: string | undefined;
  readonly agentType: string;
  readonly agentId: string;
  readonly status: string;
  readonly model: string | undefined;
  readonly durationMs: number | undefined;
  readonly tokens: number | undefined;
  readonly toolUses: number | undefined;
  // The first word and the length of the returned text; undefined without it.
  readonly word: string | undefined;
  readonly length: number | undefined;
  // Claude Code returns a note instead of a report when the subagent ran
  // out of turns; SubagentStop does not fire then, so this is the only mark.
  readonly isCapped: boolean;
}

export type Parsed =
  | { readonly kind: 'end'; readonly end: End }
  | { readonly kind: 'failure'; readonly reason: string };

// The Agent tool launches general-purpose when subagent_type is left out.
const DEFAULT_TYPE = 'general-purpose';
const CAP_NOTE = /stopped at its \d+-turn limit/u;

export function parseEnd(stdinText: string): Parsed {
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
    prompt_id: promptId,
    tool_name: toolName,
    tool_use_id: toolUseId,
    tool_input: toolInput,
    tool_response: response,
  } = payload;

  if (toolName !== 'Agent') {
    return makeFailure('tool_name is not Agent');
  }

  if (!isSafeId(sessionId)) {
    return makeFailure('session_id is not letters, digits and hyphens');
  }

  if (!isRecord(toolInput) || !isRecord(response)) {
    return makeFailure('tool_input or tool_response is not a JSON object');
  }

  const { subagent_type: agentType = DEFAULT_TYPE } = toolInput;
  const { agentId, status } = response;

  if (typeof agentType !== 'string' || typeof agentId !== 'string' || typeof status !== 'string') {
    return makeFailure('tool_input.subagent_type, tool_response.agentId or tool_response.status '
      + 'is not a string');
  }

  const text = getText(response.content);

  return {
    kind: 'end',
    end: {
      sessionId,
      promptId: getString(promptId),
      toolUseId: getString(toolUseId),
      agentType,
      agentId,
      status,
      model: getString(response.resolvedModel),
      durationMs: getNumber(response.totalDurationMs),
      tokens: getNumber(response.totalTokens),
      toolUses: getNumber(response.totalToolUseCount),
      word: text === undefined ? undefined : text.trim().split(/\s+/u)[0] ?? '',
      length: text?.length,
      isCapped: text !== undefined && CAP_NOTE.test(text),
    },
  };
}

// The text blocks of the returned content joined, or undefined when there
// is no content, as for a background launch.
function getText(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  return content
    .map((block: unknown) => (isRecord(block) ? getString(block.text) ?? '' : ''))
    .join('');
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
