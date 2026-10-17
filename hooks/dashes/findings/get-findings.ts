import { assertNever } from '../assert-never.ts';
import type { EditCall, ToolCall } from '../input/parse-payload.ts';
import { getDashLines } from './get-dash-lines.ts';
import { isMarkdown } from './is-markdown.ts';

export interface FilePlace {
  readonly kind: 'file';
  readonly line: number;
}

export interface NewStringPlace {
  readonly kind: 'new_string';
  readonly line: number;
}

export type Place = FilePlace | NewStringPlace;

export interface Finding {
  readonly filePath: string;
  readonly place: Place;
  readonly dashes: readonly number[];
}

// fileText is the file before the edit, or undefined when it could not be read.
export function getFindings(call: ToolCall, fileText: string | undefined): Finding[] {
  if (!isMarkdown(call.filePath)) {
    return [];
  }

  switch (call.tool) {
    case 'Write':
      return getDashLines(call.content).map(({ line, dashes }) => ({
        filePath: call.filePath,
        place: { kind: 'file', line },
        dashes,
      }));
    case 'Edit':
      return getEditFindings(call, fileText);
    default:
      return assertNever(call);
  }
}

function getEditFindings(call: EditCall, fileText: string | undefined): Finding[] {
  const startLine = fileText === undefined ? undefined : getStartLine(fileText, call.oldString);

  return getDashLines(call.newString).map(({ line, dashes }) => ({
    filePath: call.filePath,
    place: startLine === undefined
      ? { kind: 'new_string', line }
      : { kind: 'file', line: startLine + line - 1 },
    dashes,
  }));
}

// The line on which the first occurrence of oldString starts; with
// replace_all every occurrence receives the same text, so the first stands for all.
function getStartLine(fileText: string, oldString: string): number | undefined {
  const index = oldString === '' ? -1 : fileText.indexOf(oldString);

  return index === -1 ? undefined : fileText.slice(0, index).split('\n').length;
}
