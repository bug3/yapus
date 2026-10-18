export const TOOLS = ['Write', 'Edit'] as const;

export type Tool = (typeof TOOLS)[number];

export interface WriteCall {
  readonly tool: 'Write';
  readonly filePath: string;
  readonly content: string;
}

export interface EditCall {
  readonly tool: 'Edit';
  readonly filePath: string;
  readonly oldString: string;
  readonly newString: string;
}

export type ToolCall = WriteCall | EditCall;

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
  Edit: parseEdit,
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

function parseEdit(toolInput: ToolInput): Parsed {
  const {
    file_path: filePath,
    old_string: oldString,
    new_string: newString,
    replace_all: replaceAll,
  } = toolInput;

  if (!isText(filePath)) {
    return makeFieldFailure('file_path');
  }

  if (!isText(oldString)) {
    return makeFieldFailure('old_string');
  }

  if (!isText(newString)) {
    return makeFieldFailure('new_string');
  }

  const isReplaceAllValid = replaceAll === undefined || typeof replaceAll === 'boolean';

  if (!isReplaceAllValid) {
    return makeFailure('tool_input.replace_all is not a boolean');
  }

  return { kind: 'call', call: { tool: 'Edit', filePath, oldString, newString } };
}

function isRecord(parsedJson: unknown): parsedJson is ToolInput {
  return typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson);
}

function isTool(toolName: unknown): toolName is Tool {
  return typeof toolName === 'string' && Object.hasOwn(parsers, toolName);
}

// A lone surrogate could pair with one already in the file and form a dash
// that no check of this text would see.
function isText(field: unknown): field is string {
  return typeof field === 'string' && field.isWellFormed();
}

function describe(toolName: unknown): string {
  return typeof toolName === 'string' ? JSON.stringify(toolName) : typeof toolName;
}

function makeFieldFailure(fieldName: string): ParseFailure {
  return makeFailure(`tool_input.${ fieldName } is not a well-formed string`);
}

function makeFailure(reason: string): ParseFailure {
  return { kind: 'failure', reason };
}
