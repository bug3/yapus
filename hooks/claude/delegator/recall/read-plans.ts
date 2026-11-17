import { type Dirent, existsSync, lstatSync, readdirSync, type Stats } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isMonthName } from '../plans/is-month-name.ts';
import { isTopicName } from '../plans/is-topic-name.ts';

// The most plan files the recall names, so a project with many plans does
// not push out the prompts.
export const MAX_PLANS = 5;

// The plan of a plan directory; every other file there is the plan's detail.
const PLAN_FILE = 'plan.md';

interface Failure {
  readonly kind: 'failure';
  readonly detail: string;
}

interface Plan {
  readonly path: string;
  readonly modified: number;
}

export type ReadPlans =
  | { readonly kind: 'plans'; readonly paths: readonly string[] }
  | Failure;

// The paths of the plan files, <plansDir>/<month>/<topic>/plan.md, newest
// first by the plan file's modification time, then by path, at most
// MAX_PLANS; none when the directory does not exist. A file directly in the
// plans directory or in a month, a directory whose name is no month or no
// topic, a topic without a plan file and a plan's detail files are skipped
// before the newest are chosen.
export function readPlans(plansDir: string): ReadPlans {
  if (!existsSync(plansDir)) {
    return { kind: 'plans', paths: [] };
  }

  const months = readDirectories(plansDir, isMonthName);

  if (months.kind === 'failure') {
    return months;
  }

  const plans: Plan[] = [];

  for (const month of months.paths) {
    const read = readMonth(month);

    if (read.kind === 'failure') {
      return read;
    }

    plans.push(...read.plans);
  }

  const newest = plans.sort((a, b) => compareNewestFirst(a, b)).slice(0, MAX_PLANS);

  return { kind: 'plans', paths: newest.map(({ path }) => path) };
}

// The plans of one month: one for each topic directory that holds a plan file.
function readMonth(
  monthDirectory: string,
): { readonly kind: 'plans'; readonly plans: readonly Plan[] } | Failure {
  const topics = readDirectories(monthDirectory, isTopicName);

  if (topics.kind === 'failure') {
    return topics;
  }

  const plans: Plan[] = [];

  for (const topic of topics.paths) {
    const path = join(topic, PLAN_FILE);
    let stats: Stats | undefined;

    try {
      // Not followed: a link named plan.md is no plan file, as a link named
      // as a month or a topic is no directory.
      stats = lstatSync(path, { throwIfNoEntry: false });
    } catch (error) {
      return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
    }

    if (stats?.isFile() === true) {
      plans.push({ path, modified: stats.mtimeMs });
    }
  }

  return { kind: 'plans', plans };
}

// The paths of the directories directly in the directory whose names pass.
function readDirectories(
  directory: string,
  isName: (name: string) => boolean,
): { readonly kind: 'directories'; readonly paths: readonly string[] } | Failure {
  let entries: Dirent[];

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ directory }: ${ getFirstLine(error) }` };
  }

  const paths = entries
    .filter((entry) => entry.isDirectory() && isName(entry.name))
    .map((entry) => join(directory, entry.name));

  return { kind: 'directories', paths };
}

// Newest first; plans with one time by path, the same on every machine.
function compareNewestFirst(a: Plan, b: Plan): number {
  if (a.modified !== b.modified) {
    return b.modified - a.modified;
  }

  return a.path < b.path ? -1 : 1;
}
