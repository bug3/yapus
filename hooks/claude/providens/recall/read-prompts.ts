import { existsSync, readFileSync } from 'node:fs';
import { isRecord } from '../../../shared/is-record.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import type { LoggedPrompt } from './format-recall.ts';

export type ReadPrompts =
  | { readonly kind: 'prompts'; readonly prompts: readonly LoggedPrompt[] }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failure'; readonly detail: string };

// The prompts in the log at path, in the order they were written. A line that
// is not a logged prompt is skipped, so one damaged line costs one prompt.
export function readPrompts(path: string): ReadPrompts {
  if (!existsSync(path)) {
    return { kind: 'missing' };
  }

  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  return { kind: 'prompts', prompts: text.split('\n').flatMap(readLine) };
}

function readLine(line: string): LoggedPrompt[] {
  let fields: unknown;

  try {
    fields = JSON.parse(line);
  } catch {
    return [];
  }

  if (!isRecord(fields) || typeof fields.time !== 'string' || typeof fields.prompt !== 'string') {
    return [];
  }

  return [{ time: fields.time, prompt: fields.prompt }];
}
