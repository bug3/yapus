import { writeSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { formatMessage } from '../../../../shared/format-message.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { getConfigDirectory } from '../auto/get-config-directory.ts';
import { getMemoryDirectory } from '../get-memory-directory.ts';
import { readSorting } from '../sorting/read-sorting.ts';
import { applySteps, findBackup } from './apply-steps.ts';
import {
  formatBackup,
  formatCreated,
  formatDone,
  formatGuide,
  formatSteps,
} from './format-steps.ts';
import { prepareMemoryDirectory } from './prepare-memory-directory.ts';
import { type MigrateTexts, readMigrateTexts, TEXTS_PATH } from './read-migrate-texts.ts';
import { getMovesPath, type Moves, readMoves } from './read-moves.ts';

const PROGRAM = 'delegator migrate-memory';
const APPLY = 'apply';
const USAGE = 'the arguments are not <project dir> [apply]; give the absolute path of the project '
  + 'and after it nothing or the word apply, nothing changed';
const REINSTALL = 'reinstall the plugin';

interface Input {
  readonly projectRoot: string;
  readonly mode: 'list' | 'apply';
  readonly configDirectory: string | undefined;
  readonly time: Date;
}

function main(): void {
  try {
    const input = readInput();

    stop(input === undefined ? [USAGE] : migrate(input));
  } catch (error) {
    stop([`crashed: ${ getFirstLine(error) }; fix the program`]);
  }
}

// The project comes from the first argument, never from the environment or
// the working directory, so the command names what it changes. The
// environment says only where Claude Code keeps the auto memory, and the
// clock gives the backup its name.
function readInput(): Input | undefined {
  const [projectRoot, word, ...extra] = process.argv.slice(2);
  const isKnown = (word === undefined || word === APPLY) && extra.length === 0;

  if (projectRoot === undefined || !isAbsolute(projectRoot) || !isKnown) {
    return undefined;
  }

  return {
    projectRoot,
    mode: word === undefined ? 'list' : 'apply',
    configDirectory: getConfigDirectory(process.env),
    time: new Date(),
  };
}

// Creates what the project's memory directory lacks, then prints the guide
// when the project has no moves file and its steps when it has one, and
// makes them only in apply mode. Gives the failures. The program's own texts
// are read before the first change, so a broken install changes nothing.
function migrate(input: Input): readonly string[] {
  const { projectRoot, mode, configDirectory } = input;
  const memoryDirectory = getMemoryDirectory(projectRoot);
  const read = readMigrateTexts(TEXTS_PATH);
  const sorting = readSorting(memoryDirectory);

  if (read.kind === 'failure') {
    return [`${ read.detail }; ${ REINSTALL }`];
  }

  if (sorting.kind === 'failure') {
    return [`${ sorting.detail }; ${ REINSTALL }`];
  }

  const prepared = prepareMemoryDirectory(projectRoot);

  if (prepared.kind === 'failure') {
    return [prepared.detail];
  }

  const found = readMoves(projectRoot, configDirectory);

  switch (found.kind) {
    case 'failure':
      return found.details;
    case 'none':
      print([
        ...(prepared.kind === 'created' ? [formatCreated(read.texts, memoryDirectory)] : []),
        formatGuide(read.texts, getMovesPath(projectRoot), sorting.text),
      ]);

      return [];
    case 'moves':
      return mode === 'apply'
        ? apply(input, read.texts, found.moves)
        : list(read.texts, found.moves);
  }
}

function list(texts: MigrateTexts, moves: Moves): readonly string[] {
  print([...formatSteps(moves), texts.listed]);

  return [];
}

// Every change is printed before the first is made, the backup with them:
// its directory is named by the time of this run, so a run that makes no
// step names none.
function apply(input: Input, texts: MigrateTexts, moves: Moves): readonly string[] {
  const { projectRoot, time } = input;
  const backup = findBackup(moves.autoDirectory, time);

  if (backup.kind === 'failure') {
    return [backup.detail];
  }

  print([formatBackup(moves.autoDirectory, backup.directory), ...formatSteps(moves)]);

  const applied = applySteps(projectRoot, moves, backup.directory);

  if (applied.kind === 'failure') {
    return [applied.detail];
  }

  print([formatDone(texts, backup.directory)]);

  return [];
}

// writeSync, because process.exit can drop a pending write to a pipe.
function print(lines: readonly string[]): void {
  writeSync(process.stdout.fd, lines.map((line) => `${ line }\n`).join(''));
}

function stop(failures: readonly string[]): never {
  for (const failure of failures) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, failure) }\n`);
  }

  process.exit(failures.length === 0 ? 0 : 2);
}

main();
