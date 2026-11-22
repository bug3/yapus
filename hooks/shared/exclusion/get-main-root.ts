import { realpathSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { runGit } from '../git/run-git.ts';

const COMMON_DIR_ARGS = ['rev-parse', '--path-format=absolute', '--git-common-dir'];
const MAIN_GIT_DIR_NAME = '.git';

// The real path of the main checkout's root for directory, which a linked
// worktree and a subdirectory share through the common git directory; outside
// a work tree, or with a common directory not named .git, directory itself.
export function getMainRoot(directory: string, env: NodeJS.ProcessEnv): string {
  const commonDir = runGit(COMMON_DIR_ARGS, directory, env);
  const commonPath = commonDir.stdout.trimEnd();
  const isMainGitDir = commonDir.status === 0 && basename(commonPath) === MAIN_GIT_DIR_NAME;

  return realpathSync(isMainGitDir ? dirname(commonPath) : directory);
}
