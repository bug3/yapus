export const TOOLS = ['Write'] as const;

export type Tool = (typeof TOOLS)[number];

export interface WriteCall {
  readonly tool: 'Write';
  readonly filePath: string;
  readonly content: string;
}

export type ToolCall = WriteCall;

export interface ParsedCall {
  readonly kind: 'call';
  readonly call: ToolCall;
}

export interface ParseFailure {
  readonly kind: 'failure';
  readonly reason: string;
}

export type Parsed = ParsedCall | ParseFailure;

type ToolInput = Readonly<Record<string, unknown>>;

const parsers = {
  Write: parseWrite,
} as const satisfies Record<Tool, (toolInput: ToolInput) => Parsed>;

export function parsePayload(stdinText: string): Parsed {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return makeFailure('stdin is not JSON');
  }

  if (!isRecord(payload)) {
    return makeFailure('stdin is not a JSON object');
  }

  const { tool_name: toolName, tool_input: toolInput } = payload;

  if (!isTool(toolName)) {
    return makeFailure(`tool_name ${ describe(toolName) } is not one of ${ TOOLS.join(', ') }`);
  }

  if (!isRecord(toolInput)) {
    return makeFailure('tool_input is not a JSON object');
  }

  return parsers[toolName](toolInput);
}

function parseWrite(toolInput: ToolInput): Parsed {
  const { file_path: filePath, content } = toolInput;

  if (!isText(filePath)) {
    return makeFieldFailure('file_path');
  }

  if (!isText(content)) {
    return makeFieldFailure('content');
  }

  return { kind: 'call', call: { tool: 'Write', filePath, content } };
}

function isRecord(value: unknown): value is ToolInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTool(value: unknown): value is Tool {
  return typeof value === 'string' && Object.hasOwn(parsers, value);
}

// A lone surrogate could pair with one already in the file and form a dash
// that no check of this text would see.
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed();
}

function describe(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : typeof value;
}

function makeFieldFailure(field: string): ParseFailure {
  return makeFailure(`tool_input.${ field } is not a well-formed string`);
}

function makeFailure(reason: string): ParseFailure {
  return { kind: 'failure', reason };
}
