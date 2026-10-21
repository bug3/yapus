import { spawnSync } from 'node:child_process';
import { getFirstLine } from '../../../../shared/get-first-line.ts';

export type Program = 'git' | 'gh';

export interface RunOutput {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunFailure {
  readonly failure: string;
}

export type RunResult = RunOutput | RunFailure;

// The one seam for child processes: tests pass a fake.
export type Run = (program: Program, args: readonly string[]) => RunResult;

export interface Place {
  readonly cwd: string | undefined;
  // Epoch milliseconds by which every call of the judging has ended.
  readonly deadline: number;
}

// Each call ends within its program's limit and what is left of the deadline,
// all inside the 10 s of the hook.
const LIMITS_MS: Record<Program, number> = { git: 3000, gh: 5000 };

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

// Runs the program with args (no shell) in the place's directory. A run that ends
// with an exit code, zero or not, comes back for the caller to judge; a missing
// directory, a spent budget, a timeout, a spawn error or a kill by signal comes
// back as a failure whose text is "<program> <args>: <detail>".
export function run(program: Program, args: readonly string[], place: Place): RunResult {
  const { cwd } = place;

  if (cwd === undefined) {
    return failed(program, args, 'the tool call names no working directory');
  }

  const timeout = Math.min(LIMITS_MS[program], place.deadline - Date.now());

  if (timeout <= 0) {
    return failed(program, args, 'ran out of its time budget');
  }

  try {
    const result = spawnSync(program, [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    if (result.error !== undefined) {
      return failed(program, args, result.error.message);
    }

    return result.status === null
      ? failed(program, args, `killed by ${ String(result.signal) }`)
      : { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return failed(program, args, getFirstLine(error));
  }
}

function failed(program: Program, args: readonly string[], detail: string): RunFailure {
  return { failure: `${ program } ${ args.join(' ') }: ${ detail }` };
}
