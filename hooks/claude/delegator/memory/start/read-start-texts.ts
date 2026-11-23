import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';

export const START_TEXTS_PATH = join(import.meta.dirname, 'start.md');

export const COUNT_PLACEHOLDER = '<n>';

export const NAME_PLACEHOLDER = '<name>';

export const DESCRIPTION_PLACEHOLDER = '<description>';

export const LIMIT_PLACEHOLDER = '<limit>';

export const TARGET_PLACEHOLDER = '<target>';

// The memory list's own words, one line each in the texts file. The reasons
// of a file that cannot be read are not among them: the reader of the memory
// directory words those.
export interface StartTexts {
  // The directories, with a count after the name of each.
  readonly directories: string;
  readonly signpostsHeader: string;
  // One rule, by its name and description.
  readonly signpost: string;
  readonly upkeep: string;
  // A work file by its name, with its days.
  readonly staleWork: string;
  // The index with its line count and the limit.
  readonly longIndex: string;
  // An index line by its number, with the target it links.
  readonly missingTarget: string;
  // What closes the findings.
  readonly tidy: string;
  // What stands for the lines left out, with their count.
  readonly more: string;
}

export type ReadStartTexts =
  | { readonly kind: 'texts'; readonly texts: StartTexts }
  | { readonly kind: 'failure'; readonly detail: string };

// The nine lines of the file at path, in the order of StartTexts, or why the
// file cannot be read.
export function readStartTexts(path: string): ReadStartTexts {
  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  const [
    directories = '',
    signpostsHeader = '',
    signpost = '',
    upkeep = '',
    staleWork = '',
    longIndex = '',
    missingTarget = '',
    tidy = '',
    more = '',
  ] = text.split('\n');

  return {
    kind: 'texts',
    texts: {
      directories,
      signpostsHeader,
      signpost,
      upkeep,
      staleWork,
      longIndex,
      missingTarget,
      tidy,
      more,
    },
  };
}
