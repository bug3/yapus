import { type Dirent, existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isRecord } from '../../../shared/is-record.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';
import { findSessionFile } from '../sessions/find-session-file.ts';
import { getSessionPath, getSessionsDirectory } from '../sessions/get-session-path.ts';
import { getStateDirectory } from './get-state-directory.ts';
import { type Found, mergeFound } from './merge-found.ts';

// The directory of the older layout: one <session id>.jsonl per session and
// an ignore file.
const OLD_DIRECTORY = 'prompts';
const IGNORE_FILE = '.gitignore';
const LOG_ENDING = '.jsonl';
const NONE: Found = { moves: [], left: [] };

type FirstTime =
  | { readonly kind: 'time'; readonly time: string }
  | { readonly kind: 'none'; readonly reason: string };

// The moves that bring the prompt logs of the older layout into the sessions
// directory, while .yapus/prompts/ exists: each log to the file its first
// line with a time names, and last the removal of the directory, when nothing
// stays in it. Left, each with its reason: a log whose session has a file
// already, a log without a time, an entry that is no log, and a directory
// that cannot be read. While one of them stays, the older ignore file stays
// with it and keeps it out of git; otherwise that file goes as addIgnore
// says. Nothing is changed, so a run that stopped before the ignore file or
// the removal is finished by the next.
export function findLogMoves(projectRoot: string): Found {
  const oldDirectory = join(getStateDirectory(projectRoot), OLD_DIRECTORY);

  if (!existsSync(oldDirectory)) {
    return NONE;
  }

  let entries: Dirent[];

  try {
    // A file of that name is no directory of the older layout.
    if (!lstatSync(oldDirectory).isDirectory()) {
      return NONE;
    }

    entries = readdirSync(oldDirectory, { withFileTypes: true });
  } catch (error) {
    return leave(OLD_DIRECTORY, `it cannot be read: ${ getFirstLine(error) }; make it readable`);
  }

  const logs = mergeFound(
    entries
      .filter((entry) => !isIgnoreFile(entry))
      .sort((a, b) => compareNames(a, b))
      .map((entry) => findLogMove(projectRoot, entry)),
  );

  if (logs.left.length > 0) {
    return logs;
  }

  const found = entries.some((entry) => isIgnoreFile(entry)) ? addIgnore(projectRoot, logs) : logs;

  // The directory goes with rmdir, which fails unless it is empty.
  return found.left.length > 0
    ? found
    : mergeFound([found, { moves: [{ kind: 'removal', path: OLD_DIRECTORY }], left: [] }]);
}

function isIgnoreFile(entry: Dirent): boolean {
  return entry.isFile() && entry.name === IGNORE_FILE;
}

// By name, the same order on every machine.
function compareNames(a: Dirent, b: Dirent): number {
  return a.name < b.name ? -1 : 1;
}

// The move of one entry of the older directory, or why it stays. A name that
// is no session id stays: an id holds no '_', so a file ending in _<id>.jsonl
// belongs to one session alone.
function findLogMove(projectRoot: string, entry: Dirent): Found {
  const stateDirectory = getStateDirectory(projectRoot);
  const from = `${ OLD_DIRECTORY }/${ entry.name }`;
  const sessionId = entry.name.slice(0, -LOG_ENDING.length);

  if (!entry.isFile() || !entry.name.endsWith(LOG_ENDING) || !isSafeId(sessionId)) {
    return leave(from, 'it is no prompt log; move or remove it by hand');
  }

  const first = readFirstTime(join(stateDirectory, from));

  if (first.kind === 'none') {
    return leave(from, first.reason);
  }

  const session = findSessionFile(projectRoot, sessionId);

  if (session.kind === 'failure') {
    return leave(from, session.detail);
  }

  // A session resumed across the plugin's update had a prompt logged in the
  // present layout before the upgrade ran; two logs are never merged.
  if (session.kind === 'file') {
    const present = relative(stateDirectory, session.path);

    return leave(from, `the session already has ${ present }; merge or remove one by hand`);
  }

  const to = relative(stateDirectory, getSessionPath(projectRoot, sessionId, first.time));

  return { moves: [{ kind: 'log', from, to }], left: [] };
}

// The time of the first line that carries one, which is the time of the
// session's first logged prompt.
function readFirstTime(path: string): FirstTime {
  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = `it cannot be read: ${ getFirstLine(error) }; make it readable`;

    return { kind: 'none', reason };
  }

  const time = text.split('\n').flatMap((line) => readTime(line)).at(0);

  return time === undefined
    ? { kind: 'none', reason: 'no line carries a time; move or remove it by hand' }
    : { kind: 'time', time };
}

// The time of a line as remember writes it, the ISO form in UTC with
// milliseconds: the file's month and stamp are cut from that text.
function readTime(line: string): string[] {
  let fields: unknown;

  try {
    fields = JSON.parse(line);
  } catch {
    return [];
  }

  if (!isRecord(fields) || typeof fields.time !== 'string') {
    return [];
  }

  const { time } = fields;
  const isIso = !Number.isNaN(Date.parse(time)) && new Date(time).toISOString() === time;

  return isIso ? [time] : [];
}

// The older ignore file beside the moves of the logs, once every log moves:
// moved first when the sessions directory has none, so an edited one is kept
// and no new one is written in its place; removed after the logs when the
// present one holds the same bytes; left when the two differ.
function addIgnore(projectRoot: string, logs: Found): Found {
  const stateDirectory = getStateDirectory(projectRoot);
  const present = join(getSessionsDirectory(projectRoot), IGNORE_FILE);
  const from = `${ OLD_DIRECTORY }/${ IGNORE_FILE }`;
  const to = relative(stateDirectory, present);

  if (!existsSync(present)) {
    return mergeFound([{ moves: [{ kind: 'ignore', from, to }], left: [] }, logs]);
  }

  let isSame: boolean;

  try {
    isSame = readFileSync(join(stateDirectory, from)).equals(readFileSync(present));
  } catch (error) {
    const reason = `it cannot be compared with ${ to }: ${ getFirstLine(error) }`;

    return mergeFound([logs, leave(from, `${ reason }; make both readable`)]);
  }

  return mergeFound([
    logs,
    isSame
      ? { moves: [{ kind: 'removal', path: from }], left: [] }
      : leave(from, `it differs from ${ to }; keep one by hand`),
  ]);
}

function leave(path: string, reason: string): Found {
  return { moves: [], left: [{ path, reason }] };
}
