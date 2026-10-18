import { spawnSync } from 'node:child_process';
import { getFirstLine } from '../../../shared/get-first-line.ts';

export interface GitFailure {
  readonly kind: 'failure';
  readonly reason: string;
}

export interface GitRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface Place {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

export const LIMIT_SECONDS = 10;

// A diff of a large change outgrows the 1 MiB default and would kill the run.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

// Runs git with args in the place, within the time limit. A run that ends
// with an exit code, zero or not, comes back as a GitRun for the caller to
// judge; a timeout, a spawn error or a kill by signal comes back as a failure
// whose reason is "git <args>: <detail>".
export function runGit(args: readonly string[], place: Place): GitRun | GitFailure {
  const run = spawnSync('git', args, {
    cwd: place.cwd,
    env: place.env,
    encoding: 'utf8',
    timeout: LIMIT_SECONDS * 1000,
    maxBuffer: MAX_OUTPUT_BYTES,
  });

  if (run.error !== undefined) {
    return failed(args, run.error.message);
  }

  if (run.status === null) {
    return failed(args, `killed by ${ String(run.signal) }`);
  }

  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

// The trimmed stdout of a git run that exits zero; otherwise a failure.
export function getOutput(args: readonly string[], place: Place): string | GitFailure {
  const run = runGit(args, place);

  if (isFailure(run)) {
    return run;
  }

  return run.status === 0 ? run.stdout.trim() : failed(args, getFirstLine(run.stderr));
}

export function failed(args: readonly string[], detail: string): GitFailure {
  return { kind: 'failure', reason: `git ${ args.join(' ') }: ${ detail }` };
}

export function isFailure(candidate: unknown): candidate is GitFailure {
  return typeof candidate === 'object' && candidate !== null && 'kind' in candidate
    && candidate.kind === 'failure';
}
