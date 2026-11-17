import { type Dirent, existsSync, lstatSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getPlansDirectory } from '../plans/get-plans-directory.ts';
import { isMonthName } from '../plans/is-month-name.ts';
import { isTopicName } from '../plans/is-topic-name.ts';
import { getStateDirectory } from './get-state-directory.ts';
import { type Found, mergeFound, type Rename } from './merge-found.ts';

// A plan of the older layout is <topic>.md directly in the plans directory,
// its detail files in <topic>/ beside it.
const PLAN_ENDING = '.md';
// The name a plan's file takes in its own directory.
const PLAN_FILE = 'plan.md';
// The length of <YYYY-MM> at the start of an ISO time.
const MONTH_LENGTH = 7;
const NONE: Found = { moves: [], left: [] };

// The plans directory as one read found it.
interface Plans {
  readonly directory: string;
  readonly stateDirectory: string;
  // The names of the directories directly in it, the months among them.
  readonly directories: readonly string[];
}

// The moves that bring the plans of the older layout, <topic>.md directly in
// .yapus/plans/, to <month>/<topic>/plan.md, in two renames a plan: the
// directory <topic>/ into the month, then the plan file into that directory,
// so <topic>.md marks an unfinished plan until the end. A plan no month holds
// goes to the UTC month of the earliest modification time among its files; a
// plan whose directory a month already holds without a plan file, a run
// stopped between the renames, goes to that month. Left, each with its reason:
// a name that is no topic, a topic a month already holds with a plan file, a
// directory still beside the one a month holds, a topic two months hold, and
// a detail file named plan.md. A directory without its <topic>.md and every
// other file stay unnamed. Nothing is changed.
export function findPlanMoves(projectRoot: string): Found {
  const directory = getPlansDirectory(projectRoot);
  const stateDirectory = getStateDirectory(projectRoot);

  if (!existsSync(directory)) {
    return NONE;
  }

  let entries: Dirent[];

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    const reason = `it cannot be read: ${ getFirstLine(error) }; make it readable`;

    return leave(relative(stateDirectory, directory), reason);
  }

  const directories = entries.filter((entry) => entry.isDirectory()).map(({ name }) => name);
  const topics = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(PLAN_ENDING))
    .map(({ name }) => name.slice(0, -PLAN_ENDING.length))
    .sort();

  return mergeFound(
    topics.map((topic) => findTopicMoves({ directory, stateDirectory, directories }, topic)),
  );
}

// The moves of one <topic>.md, or why it stays.
function findTopicMoves(plans: Plans, topic: string): Found {
  const from = getName(plans, join(plans.directory, `${ topic }${ PLAN_ENDING }`));

  if (!isTopicName(topic)) {
    return leave(from, 'its name is no topic; rename it');
  }

  // <topic>/ would be read as the month that holds the plans.
  if (isMonthName(topic)) {
    return leave(from, 'its name is a month; rename it');
  }

  try {
    return findStateMoves(plans, topic);
  } catch (error) {
    return leave(from, `its files cannot be read: ${ getFirstLine(error) }; make them readable`);
  }
}

// The moves for the state the topic is found in. Throws when a file of the
// plan cannot be read.
function findStateMoves(plans: Plans, topic: string): Found {
  const file = join(plans.directory, `${ topic }${ PLAN_ENDING }`);
  const from = getName(plans, file);
  const detail = join(plans.directory, topic);
  const hasDetail = plans.directories.includes(topic);
  const holders = plans.directories
    .filter((name) => isMonthName(name))
    .sort()
    .map((month) => join(plans.directory, month, topic))
    .filter((holder) => isDirectory(holder));
  const twin = holders.map((holder) => join(holder, PLAN_FILE)).find((path) => isPresent(path));
  const [holder] = holders;

  if (twin !== undefined) {
    return leave(from, `${ getName(plans, twin) } exists; rename one of the two topics by hand`);
  }

  if (holder === undefined) {
    return findFreshMoves(plans, topic);
  }

  if (holders.length > 1) {
    const names = holders.map((path) => getName(plans, path)).join(' and ');

    return leave(from, `${ names } both hold the topic; keep one by hand`);
  }

  if (hasDetail) {
    const names = `${ getName(plans, detail) } stands beside ${ getName(plans, holder) }`;

    return leave(from, `${ names }; merge the two by hand`);
  }

  return { moves: [rename(plans, file, join(holder, PLAN_FILE))], left: [] };
}

// The two renames of a plan no month holds yet. A plan without detail gets
// its directory when the plan file moves.
function findFreshMoves(plans: Plans, topic: string): Found {
  const file = join(plans.directory, `${ topic }${ PLAN_ENDING }`);
  const detail = join(plans.directory, topic);
  const hasDetail = plans.directories.includes(topic);
  const taken = join(detail, PLAN_FILE);

  if (hasDetail && isPresent(taken)) {
    const reason = `${ getName(plans, taken) } has the name the plan takes; rename that file`;

    return leave(getName(plans, file), reason);
  }

  const files = hasDetail ? [file, ...listFiles(detail)] : [file];
  const target = join(plans.directory, getStartMonth(files), topic);
  const planMove = rename(plans, file, join(target, PLAN_FILE));

  return { moves: hasDetail ? [rename(plans, detail, target), planMove] : [planMove], left: [] };
}

// The UTC month of the earliest modification time: the oldest write the
// plan's files still show, since the older layout kept no start date.
function getStartMonth(files: readonly string[]): string {
  const earliest = Math.min(...files.map((path) => lstatSync(path).mtimeMs));

  return new Date(earliest).toISOString().slice(0, MONTH_LENGTH);
}

// The files below the directory, at any depth.
function listFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

// Not followed: a link is neither a plan's directory nor its file.
function isDirectory(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

function isPresent(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
}

function rename(plans: Plans, from: string, to: string): Rename {
  return { kind: 'plan', from: getName(plans, from), to: getName(plans, to) };
}

// The path as the upgrade prints it.
function getName(plans: Plans, path: string): string {
  return relative(plans.stateDirectory, path);
}

function leave(path: string, reason: string): Found {
  return { moves: [], left: [{ path, reason }] };
}
