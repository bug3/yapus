import { failed, getOutput, type GitFailure, isFailure, type Place } from './run-git.ts';

export interface Range {
  readonly base: string;
  readonly tree: string;
}

export interface Change {
  readonly files: readonly string[];
  readonly lines: number;
}

interface Entry {
  readonly path: string;
  readonly lines: number;
}

// "<added>\t<removed>\t<path>", where a binary file has "-" for both counts.
const RECORD = /^(\d+|-)\t(\d+|-)\t(.+)$/su;

// The files that differ between range.base and range.tree, in git's order, and
// the lines added plus removed in them. A binary file is listed and counts no
// lines. The output is NUL-separated, so a path with a space, a tab or a
// newline comes back exactly; a git failure comes back as a value.
export function getChange(place: Place, range: Range): Change | GitFailure {
  const args = ['diff', '--numstat', '-z', '--no-renames', range.base, range.tree];
  const output = getOutput(args, place);

  if (isFailure(output)) {
    return output;
  }

  const records = output.split('\0').filter((record) => record !== '');
  const entries = records.map((record) => parseRecord(record));
  const isUnreadable = entries.some((entry) => entry === undefined);

  if (isUnreadable) {
    return failed(args, 'unreadable numstat output');
  }

  const read = entries.filter((entry) => entry !== undefined);

  return {
    files: read.map((entry) => entry.path),
    lines: read.reduce((sum, entry) => sum + entry.lines, 0),
  };
}

function parseRecord(record: string): Entry | undefined {
  const match = RECORD.exec(record);

  if (match === null) {
    return undefined;
  }

  const [, added = '', removed = '', path = ''] = match;

  return { path, lines: countLines(added) + countLines(removed) };
}

function countLines(count: string): number {
  return count === '-' ? 0 : Number(count);
}
