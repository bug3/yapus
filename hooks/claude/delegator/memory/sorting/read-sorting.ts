import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';

const SORTING_PATH = join(import.meta.dirname, 'sorting.md');

const MEMORY_PATH_PLACEHOLDER = '<mem path>';

export type Sorting =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'failure'; readonly detail: string };

// The order a fact is sorted by, from the file at textPath, with memoryPath in
// each place of the placeholder and without the newline that ends the file, or
// why it cannot be read.
export function readSorting(memoryPath: string, textPath = SORTING_PATH): Sorting {
  let text: string;

  try {
    text = readFileSync(textPath, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ textPath }: ${ getFirstLine(error) }` };
  }

  // A function, since a replacement string would read a `$` of the path as a
  // pattern.
  return {
    kind: 'text',
    text: text.trimEnd().replaceAll(MEMORY_PATH_PLACEHOLDER, () => memoryPath),
  };
}
