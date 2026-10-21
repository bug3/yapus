export interface Change {
  readonly path: string;
  // Additions plus deletions; a binary file counts 0.
  readonly lines: number;
}

// `git diff --numstat -z --no-renames`: records "<added>\t<deleted>\t<path>" ended
// by NUL, with "-" for both counts of a binary file.
const RECORD = /^(\d+|-)\t(\d+|-)\t(.+)$/s;

// The changes in the output, or undefined when a record is not of that form.
export function readNumstat(stdout: string): Change[] | undefined {
  const changes: Change[] = [];

  for (const record of stdout.split('\0').filter((text) => text !== '')) {
    const [, added, deleted, path] = RECORD.exec(record) ?? [];

    if (added === undefined || deleted === undefined || path === undefined) {
      return undefined;
    }

    changes.push({ path, lines: count(added) + count(deleted) });
  }

  return changes;
}

function count(text: string): number {
  return text === '-' ? 0 : Number(text);
}
