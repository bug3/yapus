import { existsSync, mkdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getSessionsDirectory } from './get-session-path.ts';

// A prompt can hold a pasted secret: the session files stay the person's
// alone and out of git, while .yapus/ above them keeps the default mode for
// shared plans.
const PRIVATE_DIRECTORY_MODE = 0o700;
const IGNORE_FILE = '.gitignore';
const IGNORE_ALL = '*\n';

// Creates the sessions directory and the month directory in it private when
// they are missing, and writes the ignore file of the sessions directory
// whenever it is missing, so a directory a repository ships gets one too.
// Nothing that exists is changed: the person edits the ignore file to keep the
// prompts in git. Without it a sessions directory this run created is
// removed again.
export function prepareMonthDirectory(projectRoot: string, month: string): void {
  const sessionsDirectory = getSessionsDirectory(projectRoot);
  const isCreated = !existsSync(sessionsDirectory);

  if (isCreated) {
    mkdirSync(dirname(sessionsDirectory), { recursive: true });
    mkdirSync(sessionsDirectory, { mode: PRIVATE_DIRECTORY_MODE });
  }

  try {
    writeFileSync(join(sessionsDirectory, IGNORE_FILE), IGNORE_ALL, { flag: 'wx' });
  } catch (error) {
    if (!isExisting(error)) {
      if (isCreated) {
        rmdirSync(sessionsDirectory);
      }

      throw error;
    }
  }

  const monthDirectory = join(sessionsDirectory, month);

  if (!existsSync(monthDirectory)) {
    mkdirSync(monthDirectory, { mode: PRIVATE_DIRECTORY_MODE });
  }
}

function isExisting(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}
