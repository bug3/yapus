import {
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { readIndexLinks } from '../auto/read-index-links.ts';
import { getMemoryDirectory } from '../get-memory-directory.ts';
import { readFrontmatter } from '../read-frontmatter.ts';
import { formatBackup, formatStep } from './format-steps.ts';
import { getMovesPath, INDEX_FILE, type Moves, type Step } from './read-moves.ts';

const BACKUPS_DIRECTORY = 'memory-backup';

// The length of an ISO time down to its seconds.
const SECONDS_LENGTH = 19;

// The description line of a topic file as Claude Code stores it, a YAML
// line: the text after the key, in quotes or not.
const DESCRIPTION = /^description:[ \t]*(.*?)[ \t]*$/mu;

const AFTER_FAILURE = 'no step after it is made; repair it and run the command again';
const DONE = { kind: 'done' } as const;

export type Applied =
  | { readonly kind: 'done' }
  | { readonly kind: 'failure'; readonly detail: string };

export type Backup =
  | { readonly kind: 'free'; readonly directory: string }
  | { readonly kind: 'failure'; readonly detail: string };

// One change of the run, named by the line that is printed for it.
interface Change {
  readonly line: string;
  readonly make: () => void;
}

// The directory the run at this time copies the auto memory directory to,
// memory-backup/<UTC stamp> beside it, where Claude Code does not read it as
// memory; a failure when it exists, since a backup is never written into
// another.
export function findBackup(autoDirectory: string, time: Date): Backup {
  const stamp = `${ time.toISOString().slice(0, SECONDS_LENGTH).replaceAll(':', '-') }Z`;
  const directory = join(dirname(autoDirectory), BACKUPS_DIRECTORY, stamp);

  return existsSync(directory)
    ? {
      kind: 'failure',
      detail: `the backup directory ${ directory } exists; run the command again, no step made`,
    }
    : { kind: 'free', directory };
}

// Copies the auto memory directory whole to the backup directory, makes the
// steps in order and moves the moves file into the backup. Stops at the
// first change that fails; the next run checks the moves file against what
// it then finds. A move writes the file to its target, never over a file,
// with its description as the only frontmatter line and its body as it was,
// and deletes the source. A file that is moved or removed loses its lines in
// the index, and no other line of the index changes.
export function applySteps(projectRoot: string, moves: Moves, backupDirectory: string): Applied {
  const { autoDirectory, steps } = moves;
  const movesPath = getMovesPath(projectRoot);
  const movesBackup = join(backupDirectory, basename(movesPath));
  const changes: readonly Change[] = [
    {
      line: formatBackup(autoDirectory, backupDirectory),
      make: () => {
        copyDirectory(autoDirectory, backupDirectory);
      },
    },
    ...steps.map((step) => ({
      line: formatStep(step),
      make: () => {
        applyStep(getMemoryDirectory(projectRoot), autoDirectory, step);
      },
    })),
    {
      line: `${ movesPath } -> ${ movesBackup }`,
      make: () => {
        moveFile(movesPath, movesBackup);
      },
    },
  ];

  for (const { line, make } of changes) {
    try {
      make();
    } catch (error) {
      return {
        kind: 'failure',
        detail: `${ line } failed: ${ getFirstLine(error) }; ${ AFTER_FAILURE }`,
      };
    }
  }

  return DONE;
}

// The backup directory is created by this call alone, so a directory that
// appeared since it was found free fails the copy.
function copyDirectory(autoDirectory: string, backupDirectory: string): void {
  mkdirSync(dirname(backupDirectory), { recursive: true });
  mkdirSync(backupDirectory);
  cpSync(autoDirectory, backupDirectory, { recursive: true });
}

function applyStep(memoryDirectory: string, autoDirectory: string, step: Step): void {
  const source = join(autoDirectory, step.file);

  if (step.kind === 'move') {
    const target = join(memoryDirectory, step.directory, `${ step.name }.md`);

    writeFileSync(target, getMovedText(readFileSync(source, 'utf8')), { flag: 'wx' });
  }

  unlinkSync(source);
  dropIndexLines(join(autoDirectory, INDEX_FILE), step.file);
}

// The text of a moved file: its description alone as the frontmatter, in
// the form the reader of the project's memory takes, and the body under it.
// The reader takes a description from its first quote to its last and
// unescapes nothing, so the text is written as it is.
function getMovedText(sourceText: string): string {
  const { body } = readFrontmatter(sourceText);
  const frontmatter = sourceText.slice(0, sourceText.length - body.length);
  const [, written = ''] = DESCRIPTION.exec(frontmatter) ?? [];

  return `---\ndescription: "${ unquote(written) }"\n---\n${ body }`;
}

// A YAML text without the quotes around it and the escape of its own quote.
function unquote(written: string): string {
  const inner = written.slice(1, -1);

  if (written.length > 1 && written.startsWith('"') && written.endsWith('"')) {
    return inner.replaceAll(/\\(["\\])/gu, '$1');
  }

  return written.length > 1 && written.startsWith("'") && written.endsWith("'")
    ? inner.replaceAll("''", "'")
    : written;
}

// Takes every line that links the file out of the index. The index is read
// at each step, so a line another session added since the last one stays.
function dropIndexLines(indexPath: string, file: string): void {
  const lines = readFileSync(indexPath, 'utf8').split('\n');
  const kept = lines.filter(
    (line) => !readIndexLinks(line).some(({ target }) => target === file),
  );

  if (kept.length < lines.length) {
    writeFileSync(indexPath, kept.join('\n'));
  }
}

// A copy and a removal, since a rename fails between two volumes; the copy
// never replaces a file.
function moveFile(from: string, to: string): void {
  copyFileSync(from, to, constants.COPYFILE_EXCL);
  unlinkSync(from);
}
