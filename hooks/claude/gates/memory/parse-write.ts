import { isRecord } from '../../../shared/is-record.ts';

// What a Write or an Edit call says of the file it writes.
export interface Write {
  // As the call carries it.
  readonly filePath: string;
  // The file's whole text, which a Write call carries; undefined for an Edit
  // call, which carries a part of it.
  readonly content: string | undefined;
  // The text an Edit call puts in, the whole text of a file it creates;
  // undefined for a Write call.
  readonly newString: string | undefined;
}

export type Parsed =
  | { readonly kind: 'write'; readonly write: Write }
  | { readonly kind: 'failure'; readonly reason: string };

// The file a PreToolUse payload writes, or why the text names none.
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

  const { tool_input: toolInput } = payload;

  if (!isRecord(toolInput)) {
    return makeFailure('tool_input is not a JSON object');
  }

  const { file_path: filePath, content, new_string: newString } = toolInput;

  if (typeof filePath !== 'string') {
    return makeFailure('tool_input.file_path is not a string');
  }

  if (content !== undefined && typeof content !== 'string') {
    return makeFailure('tool_input.content is not a string');
  }

  if (newString !== undefined && typeof newString !== 'string') {
    return makeFailure('tool_input.new_string is not a string');
  }

  return { kind: 'write', write: { filePath, content, newString } };
}

function makeFailure(reason: string): Parsed {
  return { kind: 'failure', reason };
}
