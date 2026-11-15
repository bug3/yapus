import { type Dirent, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';

// The most plan files the recall names, so a project with many plans does
// not push out the prompts.
export const MAX_PLANS = 5;

const PLAN_EXTENSION = '.md';

export type ReadPlans =
  | { readonly kind: 'plans'; readonly paths: readonly string[] }
  | { readonly kind: 'failure'; readonly detail: string };

// The paths of the plan files directly in the plans directory, newest first by
// modification time, then by name, at most MAX_PLANS; none when the directory
// does not exist. Subdirectories hold a plan's detail files, not plans.
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
    .filter((entry) => entry.isFile() && entry.name.endsWith(PLAN_EXTENSION))
    .map((entry) => {
      const path = join(plansDir, entry.name);

      return { path, modified: statSync(path).mtimeMs };
    })
    .sort((a, b) => compareNewestFirst(a, b))
    .slice(0, MAX_PLANS);

  return { kind: 'plans', paths: plans.map(({ path }) => path) };
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
