import { execFileSync } from 'node:child_process';

const GIT_VARIABLE_PREFIX = 'GIT_';
const AGENT_VARIABLE = 'CLAUDECODE';
const ISOLATION: NodeJS.ProcessEnv = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  XDG_CONFIG_HOME: '/dev/null',
};
const TIMEOUT_MS = 10000;

// Inside a git hook, git exports GIT_DIR, GIT_INDEX_FILE and similar, which
// send a child git call to the outer repository; the machine's global config
// (excludes, default branch, identity) changes results too. The returned
// environment has neither, and no CLAUDECODE, which marks an agent's push.
export function getGitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const kept = Object.entries(env)
    .filter(([name]) => !name.startsWith(GIT_VARIABLE_PREFIX) && name !== AGENT_VARIABLE);

  return { ...Object.fromEntries(kept), ...ISOLATION };
}

// The stdout of git run with args in cwd, isolated from the caller's
// environment and the machine's git config.
export function runGit(args: readonly string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: getGitEnv(process.env),
    timeout: TIMEOUT_MS,
  });
}
