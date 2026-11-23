import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';

export const TEXTS_PATH = join(import.meta.dirname, 'migrate.md');

export const MEMORY_PATH_PLACEHOLDER = '<mem path>';

export const MOVES_PATH_PLACEHOLDER = '<moves path>';

export const BACKUP_PLACEHOLDER = '<backup>';

const EXPECTED = [
  `a line with ${ MEMORY_PATH_PLACEHOLDER }`,
  `a line with ${ MOVES_PATH_PLACEHOLDER } twice`,
  'a line',
  `a line with ${ BACKUP_PLACEHOLDER }`,
].join(', ');

// The migration's own words to the main agent, one line each in the texts
// file.
export interface MigrateTexts {
  // The first line of the run that created the project's memory directory.
  readonly created: string;
  // What a run that finds no moves file asks for.
  readonly guide: string;
  // The last line of a run that lists the steps and makes none.
  readonly listed: string;
  // The last line of a run that made the steps.
  readonly done: string;
}

export type ReadMigrateTexts =
  | { readonly kind: 'texts'; readonly texts: MigrateTexts }
  | { readonly kind: 'failure'; readonly detail: string };

// The created line, the guide, the listed line and the done line in the file
// at path, in that order, or why they cannot be used.
export function readMigrateTexts(path: string): ReadMigrateTexts {
  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  const [created = '', guide = '', listed = '', done = '', ...rest] = text.split('\n');
  const isComplete = rest.join('') === '' && listed !== ''
    && holds(created, MEMORY_PATH_PLACEHOLDER, 1) && holds(guide, MOVES_PATH_PLACEHOLDER, 2)
    && holds(done, BACKUP_PLACEHOLDER, 1);

  if (!isComplete) {
    return { kind: 'failure', detail: `${ path } does not hold four lines: ${ EXPECTED }` };
  }

  return { kind: 'texts', texts: { created, guide, listed, done } };
}

function holds(line: string, placeholder: string, times: number): boolean {
  return line.split(placeholder).length === times + 1;
}
