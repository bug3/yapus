import { spawnSync } from 'node:child_process';

const GIT_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const GIT_VARIABLE_PREFIX = 'GIT_';

export interface GitRun {
  readonly status: number;
  readonly stdout: string;
}

// Runs a reading git command in cwd within the time limit. A run that ends
// with an exit code, zero or not, comes back for the caller to judge; a
// timeout, a spawn error or a kill by signal throws. The GIT_* variables a
// git hook exports are left out of env, as they would send the call elsewhere.
export function runGit(args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): GitRun {
  const kept = Object.entries(env)
    .filter(([name]) => !name.startsWith(GIT_VARIABLE_PREFIX));
  const run = spawnSync('git', ['--literal-pathspecs', ...args], {
    cwd,
    encoding: 'utf8',
    env: Object.fromEntries(kept),
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });

  if (run.error !== undefined) {
    throw new Error(`git ${ args.join(' ') }: ${ run.error.message }`);
  }

  if (run.status === null) {
    throw new Error(`git ${ args.join(' ') }: killed by ${ String(run.signal) }`);
  }

  return { status: run.status, stdout: run.stdout };
}
