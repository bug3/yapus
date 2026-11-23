import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { findMemoryDirectory } from './find-memory-directory.ts';
import { DIRECTORIES, type Directory } from './get-memory-directory.ts';
import { isFile } from './is-file.ts';
import { type MemoryEvent, parseEvent } from './parse-event.ts';
import { readFrontmatter } from './read-frontmatter.ts';

// The ending of a memory file; a file of another ending is not read.
const ENDING = '.md';

// A memory file whose frontmatter holds a description.
export interface Entry {
  readonly directory: Directory;
  // The file's name without its ending.
  readonly name: string;
  // From the project root.
  readonly path: string;
  readonly description: string;
  // Of a rule alone: the hooked call it belongs to.
  readonly event: MemoryEvent | undefined;
  // Of a rule alone: the name of its successor, as it is written.
  readonly supersededBy: string | undefined;
  // Of a work entry alone: the path of its plan, from the project root or
  // absolute, as it is written.
  readonly plan: string | undefined;
  readonly modifiedAt: Date;
  readonly body: string;
}

// What keeps a file, or one line of its frontmatter, from being used.
export interface Problem {
  // From the project root.
  readonly path: string;
  readonly reason: string;
}

export interface Entries {
  readonly entries: readonly Entry[];
  readonly problems: readonly Problem[];
}

// A Markdown file directly in one of the three directories.
interface MemoryFile {
  readonly directory: Directory;
  readonly name: string;
  readonly path: string;
}

interface FileRead {
  readonly entry: Entry | undefined;
  readonly problems: readonly Problem[];
}

// The entries of the project's memory, by directory in the order of
// DIRECTORIES and then by name, and its problems by path; two empty lists
// when the project holds no memory directory. A file with a description is an
// entry, also when another line of its frontmatter gives a problem: an event
// of neither form is left out of the entry, and a successor or a plan that
// names nothing stays as it is written. A rule's lines are read under rules/
// alone and a plan under work/ alone. A name that starts with a dot, at any
// depth, a file that is not Markdown and a link are not read. Throws when the
// directory or a file in it cannot be read.
export function readEntries(projectRoot: string): Entries {
  const memoryDirectory = findMemoryDirectory(projectRoot);

  if (memoryDirectory === undefined) {
    return { entries: [], problems: [] };
  }

  const listed = listMarkdownFiles(memoryDirectory).map((segments) => ({
    path: relative(projectRoot, join(memoryDirectory, ...segments)),
    segments,
  }));
  const files = listed
    .map(({ path, segments }) => getMemoryFile(path, segments))
    .filter((file) => file !== undefined)
    .sort((a, b) => compareFiles(a, b));
  const placed = new Set(files.map(({ path }) => path));
  const ruleNames = new Set(
    files.filter(({ directory }) => directory === 'rules').map(({ name }) => name),
  );
  const reads = files.map((file) => readFile(projectRoot, file, ruleNames));
  const problems = [
    ...listed
      .filter(({ path }) => !placed.has(path))
      .map(({ path }) => ({ path, reason: 'outside work/, rules/ and reference/' })),
    ...reads.flatMap((read) => read.problems),
  ];

  return {
    entries: reads.map(({ entry }) => entry).filter((entry) => entry !== undefined),
    problems: problems.sort((a, b) => compareText(a.path, b.path)),
  };
}

// The Markdown files below the directory, at any depth, each as the names
// that lead to it from the directory.
function listMarkdownFiles(memoryDirectory: string): string[][] {
  return readdirSync(memoryDirectory, { recursive: true, withFileTypes: true })
    .filter((listing) => listing.isFile() && listing.name.endsWith(ENDING))
    .map((listing) => relative(memoryDirectory, join(listing.parentPath, listing.name)).split(sep))
    .filter((segments) => segments.every((segment) => !segment.startsWith('.')));
}

function getMemoryFile(path: string, segments: readonly string[]): MemoryFile | undefined {
  const [first, fileName, ...deeper] = segments;
  const directory = DIRECTORIES.find((known) => known === first);

  if (directory === undefined || fileName === undefined || deeper.length > 0) {
    return undefined;
  }

  return { directory, name: fileName.slice(0, -ENDING.length), path };
}

function readFile(
  projectRoot: string,
  file: MemoryFile,
  ruleNames: ReadonlySet<string>,
): FileRead {
  const absolutePath = join(projectRoot, file.path);
  const { fields, body } = readFrontmatter(readFileSync(absolutePath, 'utf8'));
  const description = fields.get('description') ?? '';
  const eventText = file.directory === 'rules' ? fields.get('event') : undefined;
  const event = eventText === undefined ? undefined : parseEvent(eventText);
  const supersededBy = file.directory === 'rules' ? fields.get('superseded-by') : undefined;
  const plan = file.directory === 'work' ? fields.get('plan') : undefined;
  const reasons = [
    description === '' ? 'no description' : undefined,
    eventText !== undefined && event === undefined
      ? `event "${ eventText }" is neither gh <group> <action> nor launch <agent type>`
      : undefined,
    supersededBy !== undefined && !ruleNames.has(supersededBy)
      ? `superseded-by names ${ supersededBy }, which is not in rules/`
      : undefined,
    plan !== undefined && !isFile(resolve(projectRoot, plan))
      ? `plan ${ plan } does not exist`
      : undefined,
  ];
  const problems = reasons
    .filter((reason) => reason !== undefined)
    .map((reason) => ({ path: file.path, reason }));

  if (description === '') {
    return { entry: undefined, problems };
  }

  const modifiedAt = lstatSync(absolutePath).mtime;

  return {
    entry: { ...file, description, event, supersededBy, plan, modifiedAt, body },
    problems,
  };
}

function compareFiles(a: MemoryFile, b: MemoryFile): number {
  if (a.directory !== b.directory) {
    return DIRECTORIES.indexOf(a.directory) - DIRECTORIES.indexOf(b.directory);
  }

  return compareText(a.name, b.name);
}

// By UTF-16 code unit, the same on every machine.
function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}
