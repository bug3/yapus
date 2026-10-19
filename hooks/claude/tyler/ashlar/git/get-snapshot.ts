import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { failed, getOutput, type GitRun, isFailure, type Place, runGit } from './run-git.ts';
import { getWorkingTree } from './get-working-tree.ts';

export interface Snapshot {
  readonly root: string;
  readonly tree: string;
}

export type SnapshotResult =
  | { readonly kind: 'snapshot'; readonly snapshot: Snapshot }
  | { readonly kind: 'none' }
  | { readonly kind: 'failure'; readonly reason: string };

const NOT_A_REPOSITORY_STATUS = 128;
const NOT_A_REPOSITORY_MESSAGE = 'not a git repository';
const INSIDE_ARGS = ['rev-parse', '--is-inside-work-tree'] as const;

// The git work tree the place is in and the working tree's current content
// as a tree id, untracked files included and ignored files excluded. The tree
// is built in a copy of the index, so the real index stays untouched. A
// directory outside a work tree gives none; a git call that times
// out, cannot start or fails unexpectedly gives a failure.
export function getSnapshot(place: Place): SnapshotResult {
  const inside = runGit(INSIDE_ARGS, place);

  if (isFailure(inside)) {
    return inside;
  }

  if (isNotARepository(inside)) {
    return { kind: 'none' };
  }

  if (inside.status !== 0) {
    return failed(INSIDE_ARGS, getFirstLine(inside.stderr));
  }

  const root = getOutput(['rev-parse', '--show-toplevel'], place);

  if (isFailure(root)) {
    return root;
  }

  const tree = getWorkingTree(root, place);

  if (isFailure(tree)) {
    return tree;
  }

  return { kind: 'snapshot', snapshot: { root, tree } };
}

function isNotARepository(run: GitRun): boolean {
  return run.status === NOT_A_REPOSITORY_STATUS && run.stderr.includes(NOT_A_REPOSITORY_MESSAGE)
    || run.status === 0 && run.stdout.trim() === 'false';
}
