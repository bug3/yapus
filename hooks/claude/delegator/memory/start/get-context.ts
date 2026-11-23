import { isAbsolute } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { isRecord } from '../../../../shared/is-record.ts';
import { findMemoryDirectory } from '../find-memory-directory.ts';
import { DIRECTORIES, getMemoryDirectory } from '../get-memory-directory.ts';
import { type Entries, type Entry, readEntries } from '../read-entries.ts';
import { getFindings } from './get-findings.ts';
import {
  COUNT_PLACEHOLDER,
  DESCRIPTION_PLACEHOLDER,
  NAME_PLACEHOLDER,
  readStartTexts,
  START_TEXTS_PATH,
  type StartTexts,
} from './read-start-texts.ts';

export interface Input {
  readonly stdinText: string;
  // Whether the person switched the session off.
  readonly isOff: boolean;
  // CLAUDE_PROJECT_DIR, the directory the session was opened in.
  readonly projectRoot: string | undefined;
  readonly now: Date;
}

export type Context =
  | { readonly kind: 'output'; readonly json: string }
  | { readonly kind: 'silence' }
  | { readonly kind: 'failure'; readonly detail: string };

// The most characters the memory list adds to a session's start.
export const CAP_CHARACTERS = 3000;

export const NOT_GIVEN = 'the memory list is not given';

const BLOCK_SEPARATOR = '\n\n';

type ReadMemory =
  | { readonly kind: 'memory'; readonly memory: Entries }
  | { readonly kind: 'failure'; readonly detail: string };

// The SessionStart output that lists the project's memory: its directories
// with their counts, the rules that belong to no hooked call and are not
// replaced, the upkeep rules and what needs tidying, or why it cannot. A
// session switched off and a project with no memory directory are silence.
// Writes nothing to disk.
export function getContext(input: Input): Context {
  const { projectRoot } = input;

  if (input.isOff || projectRoot === undefined || !hasMemory(projectRoot)) {
    return { kind: 'silence' };
  }

  const read = readStartTexts(START_TEXTS_PATH);

  if (read.kind === 'failure') {
    return makeFailure(read.detail);
  }

  const readMemory = readProjectMemory(projectRoot);

  if (readMemory.kind === 'failure') {
    return makeFailure(readMemory.detail);
  }

  const { memory } = readMemory;
  const transcriptPath = getTranscriptPath(input.stdinText);
  const findings = getFindings(read.texts, { memory, transcriptPath, now: input.now });
  const additionalContext = formatList(read.texts, memory.entries, findings);

  if (additionalContext === undefined) {
    return makeFailure(
      `the fixed lines of the memory list pass ${ String(CAP_CHARACTERS) } characters`,
    );
  }

  const hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext };

  return { kind: 'output', json: JSON.stringify({ hookSpecificOutput }) };
}

// An absolute root only, so a relative one never resolves against the hook's
// working directory.
function hasMemory(projectRoot: string): boolean {
  return isAbsolute(projectRoot) && findMemoryDirectory(projectRoot) !== undefined;
}

function readProjectMemory(projectRoot: string): ReadMemory {
  try {
    return { kind: 'memory', memory: readEntries(projectRoot) };
  } catch (error) {
    const unread = `cannot read ${ getMemoryDirectory(projectRoot) }`;

    return { kind: 'failure', detail: `${ unread }: ${ getFirstLine(error) }` };
  }
}

// The transcript the SessionStart payload names by an absolute path;
// undefined for any other payload, which costs the list its index lines
// alone.
function getTranscriptPath(stdinText: string): string | undefined {
  let payload: unknown;

  try {
    payload = JSON.parse(stdinText);
  } catch {
    return undefined;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  const { transcript_path: transcriptPath } = payload;

  return typeof transcriptPath === 'string' && isAbsolute(transcriptPath)
    ? transcriptPath
    : undefined;
}

// The list with as many of its signposts, then of its findings, as the cap
// holds; each group ends in the count of its lines left out. Undefined when
// the fixed lines alone pass the cap.
function formatList(
  texts: StartTexts,
  entries: readonly Entry[],
  findings: readonly string[],
): string | undefined {
  const directories = formatDirectories(texts.directories, entries);
  // The description is filled last: it is free text and may hold the form
  // of a placeholder.
  const signposts = entries
    .filter(({ directory, event, supersededBy }) =>
      directory === 'rules' && event === undefined && supersededBy === undefined)
    .map(({ name, description }) =>
      texts.signpost
        .replace(NAME_PLACEHOLDER, () => name)
        .replace(DESCRIPTION_PLACEHOLDER, () => description));
  const format = (keptCount: number): string => {
    const blocks = [
      [directories],
      signposts.length === 0
        ? []
        : [texts.signpostsHeader, ...cutLines(signposts, keptCount, texts.more)],
      [texts.upkeep],
      findings.length === 0
        ? []
        : [...cutLines(findings, keptCount - signposts.length, texts.more), texts.tidy],
    ];

    return blocks
      .filter((lines) => lines.length > 0)
      .map((lines) => lines.join('\n'))
      .join(BLOCK_SEPARATOR);
  };
  const listed = [...signposts, ...findings];
  const keptCounts = [...listed.keys(), listed.length].map((index) => listed.length - index);
  const keptCount = keptCounts.find((count) => format(count).length <= CAP_CHARACTERS);

  return keptCount === undefined ? undefined : format(keptCount);
}

// The directories line with the count of each directory's entries after its
// name.
function formatDirectories(directories: string, entries: readonly Entry[]): string {
  return DIRECTORIES.reduce((line, directory) => {
    const count = entries.filter((entry) => entry.directory === directory).length;

    return line.replace(
      `${ directory } ${ COUNT_PLACEHOLDER }`,
      () => `${ directory } ${ String(count) }`,
    );
  }, directories);
}

// The first keptCount lines, none for a count under zero, and after them the
// count of the lines left out when there is one.
function cutLines(lines: readonly string[], keptCount: number, more: string): string[] {
  const kept = lines.slice(0, Math.max(keptCount, 0));
  const leftOut = lines.length - kept.length;

  return leftOut === 0
    ? kept
    : [...kept, more.replace(COUNT_PLACEHOLDER, () => String(leftOut))];
}

function makeFailure(detail: string): Context {
  return { kind: 'failure', detail: `${ detail }; ${ NOT_GIVEN }` };
}
