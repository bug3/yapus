import { runGit } from './run-git.ts';

// One line for each touched path with an uncommitted or untracked change, in
// the order of touched; root must be the top level of a git work tree.
export function getRefusals(root: string, touched: readonly string[]): string[] {
  const changed = new Set(findChanged(root, touched));

  return touched
    .filter((path) => changed.has(path))
    .map((path) => `${ path } has an uncommitted or untracked change; commit or stash it first`);
}

// The paths in the porcelain -z status of the given ones, ignored files
// included (git cannot restore those). An entry is "XY path"; a rename or a
// copy is followed by one more entry holding the source path. A failed status
// throws: read as no change, it would let a write go over one.
function findChanged(root: string, touched: readonly string[]): string[] {
  const status = runGit(
    [
      'status',
      '--porcelain',
      '-z',
      '--untracked-files=all',
      '--ignored=traditional',
      '--',
      ...touched,
    ],
    root,
  );

  if (status.status !== 0) {
    throw new Error(`git status exited ${ String(status.status) }`);
  }

  const entries = status.stdout.split('\0').filter((entry) => entry !== '');
  const paths: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? '';

    paths.push(entry.slice(3));

    if (/[RC]/.test(entry.slice(0, 2))) {
      index += 1;
    }
  }

  return paths;
}
