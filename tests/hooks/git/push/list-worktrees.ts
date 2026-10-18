import { runGit } from '../../../helpers/run-git.ts';

const WORKTREE_PREFIX = 'worktree ';

// The paths git keeps as worktrees of the repository, the repository first,
// with symlinks resolved as git resolves them.
export function listWorktrees(repository: string): string[] {
  return runGit(['worktree', 'list', '--porcelain'], repository)
    .split('\n')
    .filter((line) => line.startsWith(WORKTREE_PREFIX))
    .map((line) => line.slice(WORKTREE_PREFIX.length));
}
