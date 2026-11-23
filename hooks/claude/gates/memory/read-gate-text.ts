import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { readSorting } from '../../delegator/memory/sorting/read-sorting.ts';

const GATE_TEXT_PATH = join(import.meta.dirname, 'gate.md');

const FILE_PLACEHOLDER = '<file>';

export type GateText =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'failure'; readonly detail: string };

// The reason a new file of auto memory is refused with: the line of the file
// at textPath with fileName in the place of its placeholder, and under it the
// order a fact is sorted by with memoryPath in its places; or why one of the
// two cannot be read.
export function readGateText(
  fileName: string,
  memoryPath: string,
  textPath = GATE_TEXT_PATH,
): GateText {
  let text: string;

  try {
    text = readFileSync(textPath, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ textPath }: ${ getFirstLine(error) }` };
  }

  const sorting = readSorting(memoryPath);

  if (sorting.kind === 'failure') {
    return sorting;
  }

  // A function, since a replacement string would read a `$` of the name as a
  // pattern.
  const firstLine = text.trimEnd().replaceAll(FILE_PLACEHOLDER, () => fileName);

  return { kind: 'text', text: `${ firstLine }\n${ sorting.text }` };
}
