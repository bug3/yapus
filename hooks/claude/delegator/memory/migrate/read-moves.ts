import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { isRecord } from '../../../../shared/is-record.ts';
import { getAutoMemoryFile, INDEX_FILE } from '../auto/get-auto-memory-file.ts';
import { DIRECTORIES, type Directory, getMemoryDirectory } from '../get-memory-directory.ts';
import { isFile } from '../is-file.ts';
import { readStoredDescription } from './read-stored-description.ts';

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

// A moves file whose every step can be made or was made by a run before.
export interface Moves {
  // The auto memory directory the steps name their files in.
  readonly autoDirectory: string;
  // The steps to make, in their order.
  readonly steps: readonly Step[];
  // The steps a run before this one made, in their order.
  readonly made: readonly Step[];
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
  // Claude Code's configuration directory, which holds the auto memory.
  readonly configDirectory: string;
  // The project's memory directory.
  readonly memoryDirectory: string;
}

interface Auto {
  readonly kind: 'auto';
  readonly autoDirectory: string;
  readonly topicFiles: readonly string[];
  readonly configDirectory: string;
}

// A step that can be made or was made by a run before this one, or
// undefined, and the lines against it.
interface Checked {
  readonly step: Step | undefined;
  readonly isMade: boolean;
  readonly details: readonly string[];
}

// A target of the right form that no earlier step takes, with whether a file
// or a link is at its place already, or the line against it.
type CheckedTarget =
  | { readonly kind: 'target'; readonly target: Target; readonly isThere: boolean }
  | { readonly kind: 'refused'; readonly detail: string };

export function getMovesPath(projectRoot: string): string {
  return join(getMemoryDirectory(projectRoot), MOVES_FILE);
}

// The moves file of the project, .yapus/memory/migration.json, with every
// step checked against the disk: none when the file is not there, and one
// line per failure when it is not the JSON of a moves file, its
// memoryDirectory is no auto memory directory under configDirectory or holds
// no index that is a file and not a link, a step names a file twice or one
// that is no topic file there, a target is of another form, is named twice
// or exists, or a moved file holds no description on one line. A step a run
// before this one made is no failure: a move whose file is gone and whose
// target is there, a removal whose file is gone. A step may carry other
// keys. Changes nothing.
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
    configDirectory: auto.configDirectory,
    memoryDirectory: getMemoryDirectory(projectRoot),
  };
  const checked = written.steps.map((step, position) => checkStep(step, position, state));
  const details = checked.flatMap((check) => check.details);

  if (details.length > 0) {
    return { kind: 'failure', details };
  }

  const steps = getSteps(checked, false);
  const named = new Set(steps.map(({ file }) => file));

  return {
    kind: 'moves',
    moves: {
      autoDirectory,
      steps,
      made: getSteps(checked, true),
      kept: topicFiles.filter((file) => !named.has(file)),
    },
  };
}

function getSteps(checked: readonly Checked[], isMade: boolean): Step[] {
  return checked
    .filter((check) => check.isMade === isMade)
    .map(({ step }) => step)
    .filter((step) => step !== undefined);
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

  if (!isUnlinkedFile(join(autoDirectory, INDEX_FILE))) {
    return fail(
      `${ autoDirectory } holds no ${ INDEX_FILE }`,
      'name the auto memory directory that holds the index of this project',
    );
  }

  return {
    kind: 'auto',
    autoDirectory,
    topicFiles: listTopicFiles(autoDirectory, configDirectory),
    configDirectory,
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
  const isGone = isTopicFileGone(state, file);
  const twice = first < position
    ? [
      getDetail(
        `${ named }, which step ${ getNumber(first) } names too`,
        'name each file in one step',
      ),
    ]
    : [];
  const absent = state.topicFiles.includes(file)
    ? []
    : [
      getDetail(
        `${ named }, which is no topic file in ${ state.autoDirectory }`,
        'name a file that is there',
      ),
    ];

  if (written.kind === 'remove') {
    return { step: written, isMade: isGone, details: isGone ? twice : [...twice, ...absent] };
  }

  const checked = checkTarget(written, position, state);
  const undescribed = state.topicFiles.includes(file) && !holdsDescription(state, file)
    ? [
      getDetail(
        `step ${ getNumber(position) } moves ${ file }, which has no one-line description in `
        + 'its frontmatter',
        'give it one',
      ),
    ]
    : [];

  if (checked.kind === 'refused') {
    return {
      step: undefined,
      isMade: false,
      details: [...twice, ...absent, checked.detail, ...undescribed],
    };
  }

  const step = { kind: 'move', file, ...checked.target } as const;
  const taken = checked.isThere
    ? [
      getDetail(
        `${ getMoved(written, position) }, which exists in ${ state.memoryDirectory }`,
        'choose another name or remove that file',
      ),
    ]
    : [];

  return isGone && checked.isThere
    ? { step, isMade: true, details: twice }
    : { step, isMade: false, details: [...twice, ...absent, ...taken, ...undescribed] };
}

// Whether nothing is at the place of a topic file the step names by its name
// alone: a run before this one moved or removed it.
function isTopicFileGone(state: State, file: string): boolean {
  const path = join(state.autoDirectory, file);

  return file === basename(file) && isTopicFile(path, state.configDirectory)
    && lstatSync(path, { throwIfNoEntry: false }) === undefined;
}

// Whether the topic file holds the description a move writes to its target.
function holdsDescription(state: State, file: string): boolean {
  return readStoredDescription(readFileSync(join(state.autoDirectory, file), 'utf8')) !== '';
}

// The target of a move, or the line against it: a target of another form or
// one an earlier step takes. A move never replaces a file, so the target says
// whether its place is taken.
function checkTarget(move: WrittenMove, position: number, state: State): CheckedTarget {
  const moved = getMoved(move, position);
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
  const stat = lstatSync(join(state.memoryDirectory, move.to), { throwIfNoEntry: false });

  return { kind: 'target', target: { directory, name }, isThere: stat !== undefined };
}

function getMoved(move: WrittenMove, position: number): string {
  return `step ${ getNumber(position) } moves ${ move.file } to ${ move.to }`;
}

function refuse(failed: string, remedy: string): CheckedTarget {
  return { kind: 'refused', detail: getDetail(failed, remedy) };
}

function fail(failed: string, remedy: string): Failure {
  return { kind: 'failure', details: [getDetail(failed, remedy)] };
}

// Not "nothing changed": the run has by then created what the project's
// memory directory lacked.
function getDetail(failed: string, remedy: string): string {
  return `${ failed }; ${ remedy }, no step made`;
}

// A step's number as the person counts it, from 1.
function getNumber(position: number): string {
  return String(position + 1);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING;
}

// Whether a file is at the path and not a link to one: the backup would hold
// the link, and a write to it would change the file it leads to.
function isUnlinkedFile(path: string): boolean {
  return isFile(path) && !lstatSync(path).isSymbolicLink();
}
