import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { isRecord } from '../../../../shared/is-record.ts';
import { getAutoMemoryFile } from '../auto/get-auto-memory-file.ts';
import { DIRECTORIES, type Directory, getMemoryDirectory } from '../get-memory-directory.ts';

// The index of an auto memory directory.
export const INDEX_FILE = 'MEMORY.md';

const MOVES_FILE = 'migration.json';
const MISSING = 'ENOENT';

// <directory>/<name>.md, the name of lowercase letters, digits and hyphens.
const TARGET = /^([^/]+)\/([a-z0-9-]+)\.md$/u;

const NONE = { kind: 'none' } as const;

// Where a move puts its file in the project's memory: <directory>/<name>.md.
interface Target {
  readonly directory: Directory;
  readonly name: string;
}

// One change to a topic file of the auto memory directory: a move into the
// project's memory, as <directory>/<name>.md, or a removal.
export type Step =
  | ({ readonly kind: 'move'; readonly file: string } & Target)
  | { readonly kind: 'remove'; readonly file: string };

// A moves file whose every step can be made.
export interface Moves {
  // The auto memory directory the steps name their files in.
  readonly autoDirectory: string;
  readonly steps: readonly Step[];
  // The topic files no step names, by name.
  readonly kept: readonly string[];
}

interface Failure {
  readonly kind: 'failure';
  // One line per failure, each with what to do.
  readonly details: readonly string[];
}

export type ReadMoves =
  | { readonly kind: 'none' }
  | { readonly kind: 'moves'; readonly moves: Moves }
  | Failure;

// A move as the moves file writes it, its target not yet read.
interface WrittenMove {
  readonly kind: 'move';
  readonly file: string;
  readonly to: string;
}

type WrittenStep = WrittenMove | { readonly kind: 'remove'; readonly file: string };

interface Written {
  readonly kind: 'written';
  readonly memoryDirectory: string;
  readonly steps: readonly WrittenStep[];
}

// What a step is checked against.
interface State {
  readonly steps: readonly WrittenStep[];
  readonly autoDirectory: string;
  readonly topicFiles: readonly string[];
  // The project's memory directory.
  readonly memoryDirectory: string;
}

interface Auto {
  readonly kind: 'auto';
  readonly autoDirectory: string;
  readonly topicFiles: readonly string[];
}

// A step that can be made, or undefined, and the lines against it.
interface Checked {
  readonly step: Step | undefined;
  readonly details: readonly string[];
}

type CheckedTarget =
  | { readonly kind: 'target'; readonly target: Target }
  | { readonly kind: 'refused'; readonly detail: string };

export function getMovesPath(projectRoot: string): string {
  return join(getMemoryDirectory(projectRoot), MOVES_FILE);
}

// The moves file of the project, .yapus/memory/migration.json, with every
// step checked against the disk: none when the file is not there, and one
// line per failure when it is not the JSON of a moves file, its
// memoryDirectory is no auto memory directory under configDirectory or holds
// no index that is a file and not a link, a step names a file twice or one
// that is no topic file there, or a target is of another form, is named
// twice or exists. A step may carry other keys. Changes nothing.
export function readMoves(projectRoot: string, configDirectory: string | undefined): ReadMoves {
  const movesPath = getMovesPath(projectRoot);
  let movesText: string;

  try {
    movesText = readFileSync(movesPath, 'utf8');
  } catch (error) {
    return isMissing(error)
      ? NONE
      : fail(`cannot read ${ movesPath }: ${ getFirstLine(error) }`, 'make it a file');
  }

  const written = parseMoves(movesPath, movesText);

  if (written.kind === 'failure') {
    return written;
  }

  const auto = findAuto(written.memoryDirectory, configDirectory);

  if (auto.kind === 'failure') {
    return auto;
  }

  const { autoDirectory, topicFiles } = auto;
  const state = {
    steps: written.steps,
    autoDirectory,
    topicFiles,
    memoryDirectory: getMemoryDirectory(projectRoot),
  };
  const checked = written.steps.map((step, position) => checkStep(step, position, state));
  const details = checked.flatMap((check) => check.details);

  if (details.length > 0) {
    return { kind: 'failure', details };
  }

  const steps = checked.map(({ step }) => step).filter((step) => step !== undefined);
  const named = new Set(steps.map(({ file }) => file));

  return {
    kind: 'moves',
    moves: { autoDirectory, steps, kept: topicFiles.filter((file) => !named.has(file)) },
  };
}

function parseMoves(movesPath: string, movesText: string): Written | Failure {
  let parsed: unknown;

  try {
    parsed = JSON.parse(movesText);
  } catch (error) {
    return fail(`${ movesPath } is not JSON: ${ getFirstLine(error) }`, 'write it as JSON');
  }

  if (
    !isRecord(parsed) || typeof parsed.memoryDirectory !== 'string' || !Array.isArray(parsed.steps)
  ) {
    return fail(
      `${ movesPath } is not an object with a memoryDirectory text and a steps list`,
      'give it both',
    );
  }

  const writtenSteps: readonly unknown[] = parsed.steps;
  const steps = writtenSteps.map((step) => parseStep(step));
  const details = steps.flatMap((step, position) => (step === undefined
    ? [
      getDetail(
        `step ${ getNumber(position) } of ${ movesPath } is neither { "move": "<file>", `
        + '"to": "<directory>/<name>.md" } nor { "remove": "<file>" }',
        'write it as one of the two',
      ),
    ]
    : []));

  if (details.length > 0) {
    return { kind: 'failure', details };
  }

  return {
    kind: 'written',
    memoryDirectory: parsed.memoryDirectory,
    steps: steps.filter((step) => step !== undefined),
  };
}

function parseStep(step: unknown): WrittenStep | undefined {
  if (!isRecord(step)) {
    return undefined;
  }

  const { move, to, remove } = step;

  if (typeof remove === 'string' && move === undefined && to === undefined) {
    return { kind: 'remove', file: remove };
  }

  return typeof move === 'string' && typeof to === 'string' && remove === undefined
    ? { kind: 'move', file: move, to }
    : undefined;
}

// The auto memory directory the moves file names, as its path leads to it,
// with the topic files directly in it, by name: the files a step may name.
function findAuto(memoryDirectory: string, configDirectory: string | undefined): Auto | Failure {
  const index = configDirectory === undefined
    ? undefined
    : getAutoMemoryFile(join(memoryDirectory, INDEX_FILE), configDirectory);

  if (configDirectory === undefined || index === undefined) {
    return fail(
      `memoryDirectory ${ memoryDirectory } is no auto memory directory, `
      + '<config>/projects/<slug>/memory',
      'name the one of this project',
    );
  }

  const autoDirectory = index.memoryDirectory;

  if (!isFile(join(autoDirectory, INDEX_FILE))) {
    return fail(
      `${ autoDirectory } holds no ${ INDEX_FILE }`,
      'name the auto memory directory that holds the index of this project',
    );
  }

  return {
    kind: 'auto',
    autoDirectory,
    topicFiles: listTopicFiles(autoDirectory, configDirectory),
  };
}

function listTopicFiles(autoDirectory: string, configDirectory: string): string[] {
  return readdirSync(autoDirectory, { withFileTypes: true })
    .filter((listing) => listing.isFile())
    .map(({ name }) => name)
    .filter((name) => isTopicFile(join(autoDirectory, name), configDirectory))
    .sort();
}

function isTopicFile(path: string, configDirectory: string): boolean {
  return getAutoMemoryFile(path, configDirectory)?.kind === 'topic';
}

function checkStep(written: WrittenStep, position: number, state: State): Checked {
  const { file } = written;
  const named = `step ${ getNumber(position) } names ${ file }`;
  const first = state.steps.findIndex((step) => step.file === file);
  const details = [
    first < position
      ? getDetail(
        `${ named }, which step ${ getNumber(first) } names too`,
        'name each file in one step',
      )
      : undefined,
    state.topicFiles.includes(file)
      ? undefined
      : getDetail(
        `${ named }, which is no topic file in ${ state.autoDirectory }`,
        'name a file that is there',
      ),
  ].filter((detail) => detail !== undefined);

  if (written.kind === 'remove') {
    return { step: written, details };
  }

  const checked = checkTarget(written, position, state);

  return checked.kind === 'refused'
    ? { step: undefined, details: [...details, checked.detail] }
    : { step: { kind: 'move', file, ...checked.target }, details };
}

// The target of a move, or the line against it: a target of another form,
// one an earlier step takes, or one on disk already, since a move never
// replaces a file.
function checkTarget(move: WrittenMove, position: number, state: State): CheckedTarget {
  const moved = `step ${ getNumber(position) } moves ${ move.file } to ${ move.to }`;
  const [, directoryName, name] = TARGET.exec(move.to) ?? [];
  const directory = DIRECTORIES.find((known) => known === directoryName);
  const first = state.steps.findIndex((step) => step.kind === 'move' && step.to === move.to);

  if (directory === undefined || name === undefined) {
    return refuse(
      `${ moved }, which is not <${ DIRECTORIES.join('|') }>/<name>.md with a name of lowercase `
      + 'letters, digits and hyphens',
      'write it in that form',
    );
  }

  if (first < position) {
    return refuse(
      `${ moved }, the target of step ${ getNumber(first) } too`,
      'give each file its own target',
    );
  }

  // Asked without following a link, as the write that replaces no file sees
  // it: a link that leads nowhere exists too.
  return lstatSync(join(state.memoryDirectory, move.to), { throwIfNoEntry: false }) === undefined
    ? { kind: 'target', target: { directory, name } }
    : refuse(
      `${ moved }, which exists in ${ state.memoryDirectory }`,
      'choose another name or remove that file',
    );
}

function refuse(failed: string, remedy: string): CheckedTarget {
  return { kind: 'refused', detail: getDetail(failed, remedy) };
}

function fail(failed: string, remedy: string): Failure {
  return { kind: 'failure', details: [getDetail(failed, remedy)] };
}

function getDetail(failed: string, remedy: string): string {
  return `${ failed }; ${ remedy }, nothing changed`;
}

// A step's number as the person counts it, from 1.
function getNumber(position: number): string {
  return String(position + 1);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING;
}

// A link is no file: the backup would hold the link, and a write to it would
// change the file it leads to. Asked of existsSync first, which answers false
// where a stat throws: a path that runs through a file.
function isFile(path: string): boolean {
  return existsSync(path) && lstatSync(path).isFile();
}
