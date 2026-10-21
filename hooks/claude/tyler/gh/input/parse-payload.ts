import { isAbsolute } from 'node:path';
import { isRecord } from '../../../../shared/is-record.ts';

export interface PayloadCall {
  readonly kind: 'call';
  readonly command: string;
  // The absolute directory the call starts in.
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

// A PreToolUse payload: a Bash call with its command and directory, a call of
// another tool, or why the text is neither.
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

  return isDirectory(cwd) ? { kind: 'call', command, cwd } : makeFailure('cwd is not absolute');
}

function isDirectory(field: unknown): field is string {
  return typeof field === 'string' && isAbsolute(field);
}

// A lone surrogate could pair with one next to it and form text that no
// check of this command would see.
function isText(field: unknown): field is string {
  return typeof field === 'string' && field.isWellFormed();
}

function makeFailure(reason: string): PayloadFailure {
  return { kind: 'failure', reason };
}
