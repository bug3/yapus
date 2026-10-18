import { execFileSync } from 'node:child_process';

// The environment without the variables that tie a git process to a
// repository, such as GIT_DIR and GIT_INDEX_FILE, which git sets for a hook
// in a linked worktree; git lists them itself. A git variable a caller sets
// on purpose, such as GIT_CONFIG_GLOBAL, stays.
export function getChildEnv(
  env: NodeJS.ProcessEnv,
  repository: string,
  limitSeconds: number,
): NodeJS.ProcessEnv {
  const localNames = execFileSync('git', ['rev-parse', '--local-env-vars'], {
    cwd: repository,
    encoding: 'utf8',
    env,
    timeout: limitSeconds * 1000,
  }).split('\n');

  return Object.fromEntries(Object.entries(env).filter(([name]) => !localNames.includes(name)));
}
