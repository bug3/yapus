import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { removeScannerVariables } from '../../../../shared/scanner/remove-scanner-variables.ts';
import { gateScanner } from './gate-scanner.ts';

// `scanner` runs the program that scanner.json names.
export type Program = 'git' | 'gh' | 'scanner';

export interface RunOutput {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunFailure {
  readonly failure: string;
  // Set when the program is not installed (absent means it is).
  readonly isMissing?: boolean;
}

export type RunResult = RunOutput | RunFailure;

// What a run may be given besides its arguments: text for stdin, and variables added
// to the environment of the child process.
export interface RunOptions {
  readonly input?: string | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
}

// The one seam for child processes: tests pass a fake.
export type Run = (program: Program, args: readonly string[], options?: RunOptions) => RunResult;

export interface Request extends RunOptions {
  readonly program: Program;
  readonly args: readonly string[];
}

export interface Place {
  readonly cwd: string | undefined;
  // Epoch milliseconds by which every call of the judging has ended.
  readonly deadline: number;
}

// Each call ends within its program's limit and what is left of the deadline,
// all inside the 10 s of the hook.
const LIMITS_MS: Record<Program, number> = { git: 3000, gh: 5000, scanner: 2000 };

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

// Runs the program with args (no shell) in the place's directory. A run that ends
// with an exit code, zero or not, comes back for the caller to judge; a missing
// directory, a spent budget, a timeout, a spawn error or a kill by signal comes
// back as a failure whose text is "<program> <args>: <detail>".
export function run(request: Request, place: Place): RunResult {
  const { program, args, input, env } = request;
  const { cwd } = place;

  if (cwd === undefined) {
    return failed(program, args, 'the tool call names no working directory');
  }

  const timeout = Math.min(LIMITS_MS[program], place.deadline - Date.now());

  if (timeout <= 0) {
    return failed(program, args, 'ran out of its time budget');
  }

  const scanner = program === 'scanner' ? gateScanner : undefined;

  if (scanner !== undefined && 'violation' in scanner) {
    return failed(program, args, scanner.violation);
  }

  // The scanner's environment lacks the variables that could name another config.
  const baseEnv = scanner === undefined
    ? process.env
    : removeScannerVariables(scanner, process.env);

  try {
    const result = spawnSync(scanner?.program ?? program, [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT_BYTES,
      env: { ...baseEnv, ...env },
      input: input ?? '',
      timeout,
    });

    if (result.error !== undefined) {
      const failure = failed(program, args, result.error.message);

      // A missing program is told from a missing directory, which also gives ENOENT.
      return 'code' in result.error && result.error.code === 'ENOENT' && existsSync(cwd)
        ? { ...failure, isMissing: true }
        : failure;
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
