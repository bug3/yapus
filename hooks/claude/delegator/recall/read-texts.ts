import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';

export const TEXTS_PATH = join(import.meta.dirname, 'recall.md');

export const LEFT_OUT_PLACEHOLDER = '{left-out}';

export const PATH_PLACEHOLDER = '{path}';

export const PLANS_PLACEHOLDER = '{plans}';

const EXPECTED = [
  `a header with ${ LEFT_OUT_PLACEHOLDER }`,
  'a mark',
  `a line with ${ PATH_PLACEHOLDER }`,
  `a line with ${ PLANS_PLACEHOLDER }`,
  'a notice',
].join(', ');

// The recall's own words, one line each in the texts file, so a translation
// keeps the same lines.
export interface Texts {
  readonly header: string;
  readonly cutMark: string;
  readonly pathLine: string;
  readonly plansLine: string;
  // What the main agent is told while the project holds an older layout.
  readonly notice: string;
}

export type ReadTexts =
  | { readonly kind: 'texts'; readonly texts: Texts }
  | { readonly kind: 'failure'; readonly detail: string };

// The header, the mark of a cut prompt, the path line, the plans line and the
// notice in the file at path, in that order, or why they cannot be used.
export function readTexts(path: string): ReadTexts {
  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  const [header = '', cutMark = '', pathLine = '', plansLine = '', notice = '', ...rest]
    = text.split('\n');
  const isComplete = rest.join('') === '' && cutMark !== '' && notice !== ''
    && holdsOnce(header, LEFT_OUT_PLACEHOLDER) && holdsOnce(pathLine, PATH_PLACEHOLDER)
    && holdsOnce(plansLine, PLANS_PLACEHOLDER);

  if (!isComplete) {
    return { kind: 'failure', detail: `${ path } does not hold five lines: ${ EXPECTED }` };
  }

  return { kind: 'texts', texts: { header, cutMark, pathLine, plansLine, notice } };
}

function holdsOnce(line: string, placeholder: string): boolean {
  return line.split(placeholder).length === 2;
}
