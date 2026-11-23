import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSessionMemoryDirectory, INDEX_FILE } from '../auto/get-auto-memory-file.ts';
import { readIndexLinks } from '../auto/read-index-links.ts';
import { isFile } from '../is-file.ts';
import type { Entries, Entry } from '../read-entries.ts';
import {
  COUNT_PLACEHOLDER,
  LIMIT_PLACEHOLDER,
  NAME_PLACEHOLDER,
  type StartTexts,
  TARGET_PLACEHOLDER,
} from './read-start-texts.ts';

// A work file is listed once it was left unchanged for more whole days.
const WORK_LIMIT_DAYS = 30;

// The index of an auto memory is listed once it holds more lines.
const INDEX_LIMIT_LINES = 20;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// A link target that names a topic file beside the index: no directory and
// no URL.
const BARE_TOPIC = /^[^/]+\.md$/u;

export interface Checked {
  readonly memory: Entries;
  // The session's transcript, or undefined when the session names none.
  readonly transcriptPath: string | undefined;
  readonly now: Date;
}

// One line per thing to tidy: each work file past its limit, by name; the
// index of the auto memory past its line limit, then each of its links to a
// topic file that is not beside it, by line; each problem of the memory
// directory, by path. The index is read in the memory directory beside the
// transcript, and its lines are left out where it is not there or cannot be
// read.
export function getFindings(
  texts: StartTexts,
  { memory, transcriptPath, now }: Checked,
): readonly string[] {
  const indexLines = transcriptPath === undefined
    ? []
    : getIndexLines(texts, getSessionMemoryDirectory(transcriptPath));

  return [
    ...getStaleLines(texts.staleWork, memory.entries, now),
    ...indexLines,
    ...memory.problems.map(({ path, reason }) => `${ path }: ${ reason }`),
  ];
}

// The name is filled last, so a number is never read as a placeholder.
function getStaleLines(staleWork: string, entries: readonly Entry[], now: Date): string[] {
  return entries
    .filter(({ directory }) => directory === 'work')
    .map(({ name, modifiedAt }) => ({
      name,
      days: Math.floor((now.getTime() - modifiedAt.getTime()) / MILLISECONDS_PER_DAY),
    }))
    .filter(({ days }) => days > WORK_LIMIT_DAYS)
    .map(({ name, days }) =>
      staleWork
        .replace(COUNT_PLACEHOLDER, () => String(days))
        .replace(NAME_PLACEHOLDER, () => name));
}

function getIndexLines(texts: StartTexts, memoryDirectory: string): string[] {
  const indexText = readIndex(join(memoryDirectory, INDEX_FILE));

  if (indexText === undefined) {
    return [];
  }

  const lineCount = countLines(indexText);
  const longIndex = texts.longIndex
    .replace(COUNT_PLACEHOLDER, () => String(lineCount))
    .replace(LIMIT_PLACEHOLDER, () => String(INDEX_LIMIT_LINES));
  const missingLines = readIndexLinks(indexText)
    .filter(({ target }) => BARE_TOPIC.test(target) && !isFile(join(memoryDirectory, target)))
    .map(({ line, target }) =>
      texts.missingTarget
        .replace(COUNT_PLACEHOLDER, () => String(line))
        .replace(TARGET_PLACEHOLDER, () => target));

  return lineCount > INDEX_LIMIT_LINES ? [longIndex, ...missingLines] : missingLines;
}

// The text of the index, or undefined where no file is at the path or the
// file cannot be read.
function readIndex(indexPath: string): string | undefined {
  if (!isFile(indexPath)) {
    return undefined;
  }

  try {
    return readFileSync(indexPath, 'utf8');
  } catch {
    return undefined;
  }
}

// A text that ends in a line break has no line after it.
function countLines(text: string): number {
  const lines = text.split('\n');

  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}
