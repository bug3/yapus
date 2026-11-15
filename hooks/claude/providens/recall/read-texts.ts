import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';

export const TEXTS_PATH = join(import.meta.dirname, 'recall.md');

export const LEFT_OUT_PLACEHOLDER = '{left-out}';

export const PATH_PLACEHOLDER = '{path}';

const EXPECTED = [
  `a header with ${ LEFT_OUT_PLACEHOLDER }`,
  'a mark',
  `a line with ${ PATH_PLACEHOLDER }`,
].join(', ');

// The recall's own words, one line each in the texts file, so a translation
// keeps the same lines.
export interface Texts {
  readonly header: string;
  readonly cutMark: string;
  readonly pathLine: string;
}

export type ReadTexts =
  | { readonly kind: 'texts'; readonly texts: Texts }
  | { readonly kind: 'failure'; readonly detail: string };

// The header, the mark of a cut prompt and the path line in the file at path,
// in that order, or why they cannot be used.
export function readTexts(path: string): ReadTexts {
  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  const [header = '', cutMark = '', pathLine = '', ...rest] = text.split('\n');
  const isComplete = rest.join('') === '' && cutMark !== ''
    && holdsOnce(header, LEFT_OUT_PLACEHOLDER) && holdsOnce(pathLine, PATH_PLACEHOLDER);

  if (!isComplete) {
    return { kind: 'failure', detail: `${ path } does not hold three lines: ${ EXPECTED }` };
  }

  return { kind: 'texts', texts: { header, cutMark, pathLine } };
}

function holdsOnce(line: string, placeholder: string): boolean {
  return line.split(placeholder).length === 2;
}
