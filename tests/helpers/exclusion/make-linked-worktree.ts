import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';
import { runGit } from '../run-git.ts';

// A subject the commit check accepts, for a repository whose hooks run.
const FIRST_SUBJECT = 'feat(hooks): add a check';

// A detached linked worktree of the repository at a new empty commit, in a
// fresh temporary directory removed when the test ends.
export function makeLinkedWorktree(t: TestContext, repository: string): string {
  const worktree = join(makeTempDir(t), 'worktree');

  runGit(['commit', '--quiet', '--allow-empty', '-m', FIRST_SUBJECT], repository);
  runGit(['worktree', 'add', '--quiet', '--detach', worktree], repository);

  return worktree;
}
