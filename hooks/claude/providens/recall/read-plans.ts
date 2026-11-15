import { type Dirent, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';

// The most plan files the recall names, so a project with many plans does
// not push out the prompts.
export const MAX_PLANS = 5;

// The longest plan file name listed, in UTF-16 units with the extension: a
// topic of a few words fits, and five paths stay a small part of the budget.
export const MAX_NAME_LENGTH = 64;

// A plain name: letters, combining marks and digits of any script, '.', '-'
// and '_', ending in .md. A name reaches the model as context, so one from a
// repository the person did not write cannot carry a space, a line break or
// punctuation that reads as an instruction or splits one path into two.
const PLAIN_NAME = /^[\p{L}\p{M}\p{N}._-]+\.md$/u;

export type ReadPlans =
  | { readonly kind: 'plans'; readonly paths: readonly string[] }
  | { readonly kind: 'failure'; readonly detail: string };

// The paths of the plan files directly in the plans directory, newest first by
// modification time, then by name, at most MAX_PLANS; none when the directory
// does not exist. Subdirectories hold a plan's detail files, not plans; a file
// whose name is not plain is skipped before the newest are chosen.
export function readPlans(plansDir: string): ReadPlans {
  if (!existsSync(plansDir)) {
    return { kind: 'plans', paths: [] };
  }

  let entries: Dirent[];

  try {
    entries = readdirSync(plansDir, { withFileTypes: true });
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ plansDir }: ${ getFirstLine(error) }` };
  }

  const plans = entries
    .filter((entry) => entry.isFile() && isPlainName(entry.name))
    .map((entry) => {
      const path = join(plansDir, entry.name);

      return { path, modified: statSync(path).mtimeMs };
    })
    .sort((a, b) => compareNewestFirst(a, b))
    .slice(0, MAX_PLANS);

  return { kind: 'plans', paths: plans.map(({ path }) => path) };
}

function isPlainName(name: string): boolean {
  return name.length <= MAX_NAME_LENGTH && PLAIN_NAME.test(name);
}

// Newest first; plans with one time by name, the same on every machine.
function compareNewestFirst(
  a: { readonly path: string; readonly modified: number },
  b: { readonly path: string; readonly modified: number },
): number {
  if (a.modified !== b.modified) {
    return b.modified - a.modified;
  }

  return a.path < b.path ? -1 : 1;
}
