import { isAbsolute } from 'node:path';
import { isRecord } from '../../../../shared/is-record.ts';

export interface PayloadCall {
  readonly kind: 'call';
  readonly command: string;
  readonly cwd: string;
}

export interface PayloadOther {
  readonly kind: 'other';
}

export interface PayloadFailure {
  readonly kind: 'failure';
  readonly reason: string;
}

export type Payload = PayloadCall | PayloadOther | PayloadFailure;

export function parsePayload(stdinText: string): Payload {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON');
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object');
  }

  const { tool_name: toolName, tool_input: toolInput, cwd } = payload;

  if (typeof toolName !== 'string') {
    return makeFailure('tool_name is not a string');
  }

  if (toolName !== 'Bash') {
    return { kind: 'other' };
  }

  if (!isRecord(toolInput)) {
    return makeFailure('tool_input is not a JSON object');
  }

  const { command } = toolInput;

  if (!isText(command)) {
    return makeFailure('tool_input.command is not text');
  }

  if (!isText(cwd) || !isAbsolute(cwd)) {
    return makeFailure('cwd is not an absolute path');
  }

  return { kind: 'call', command, cwd };
}

// A lone surrogate could pair with one next to it and form text that no
// check of this command would see.
function isText(field: unknown): field is string {
  return typeof field === 'string' && field.isWellFormed();
}

function makeFailure(reason: string): PayloadFailure {
  return { kind: 'failure', reason };
}
