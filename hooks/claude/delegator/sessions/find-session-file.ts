import { type Dirent, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isMonthName } from '../plans/is-month-name.ts';
import { getSessionsDirectory } from './get-session-path.ts';

export type FoundSession =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failure'; readonly detail: string };

type ReadDirectory =
  | { readonly kind: 'entries'; readonly entries: readonly Dirent[] }
  | { readonly kind: 'failure'; readonly detail: string };

// The file of the session, wherever its first logged prompt put it: the month
// directories are read newest first, up to the first name ending in
// _<id>.jsonl. Any other entry of the sessions directory, the ignore file
// among them, holds no session file. An id holds no '_', so that ending
// belongs to one session alone, and no index keeps the path in a second place.
export function findSessionFile(projectRoot: string, sessionId: string): FoundSession {
  const sessionsDirectory = getSessionsDirectory(projectRoot);

  if (!existsSync(sessionsDirectory)) {
    return { kind: 'missing' };
  }

  const read = readDirectory(sessionsDirectory);

  if (read.kind === 'failure') {
    return read;
  }

  const months = read.entries
    .filter((entry) => entry.isDirectory() && isMonthName(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const ending = `_${ sessionId }.jsonl`;

  for (const month of months) {
    const monthDirectory = join(sessionsDirectory, month);
    const monthRead = readDirectory(monthDirectory);

    if (monthRead.kind === 'failure') {
      return monthRead;
    }

    const found = monthRead.entries.find((entry) => entry.name.endsWith(ending));

    if (found !== undefined) {
      return { kind: 'file', path: join(monthDirectory, found.name) };
    }
  }

  return { kind: 'missing' };
}

function readDirectory(directory: string): ReadDirectory {
  try {
    return { kind: 'entries', entries: readdirSync(directory, { withFileTypes: true }) };
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ directory }: ${ getFirstLine(error) }` };
  }
}
