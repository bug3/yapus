import { spawnSync } from 'node:child_process';
import { getFirstLine } from '../get-first-line.ts';
import { makeScannerArguments } from './make-scanner-arguments.ts';
import { readScannerReport, type Finding } from './read-scanner-report.ts';
import { readScanner, SCANNER_PATH } from './read-scanner.ts';
import { removeScannerVariables } from './remove-scanner-variables.ts';

export interface ScanRequest {
  // The scanner's own subcommand and arguments, such as git --staged.
  readonly subcommand: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

// A scanner that is not installed is its own outcome, so that a caller can
// let the work go on; every other trouble is a failure.
export type ScanOutcome =
  | { readonly kind: 'clean' }
  | { readonly kind: 'findings'; readonly findings: readonly Finding[] }
  | { readonly kind: 'missing'; readonly program: string }
  | { readonly kind: 'failure'; readonly reason: string };

// The report is redacted, but it lists every finding of a large history.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

// Runs the scanner of scanner.json as the hooks use it. Exit 0 is clean, the
// findings exit code is findings with a report on stdout, a spawn error of
// ENOENT is a missing scanner, and anything else is a failure.
export async function runScanner(request: ScanRequest): Promise<ScanOutcome> {
  const scanner = await readScanner(SCANNER_PATH);

  if ('violation' in scanner) {
    return { kind: 'failure', reason: scanner.violation };
  }

  const run = spawnSync(scanner.program, makeScannerArguments(scanner, request.subcommand), {
    cwd: request.cwd,
    env: removeScannerVariables(scanner, request.env),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: scanner.hookSpawnSeconds * 1000,
    maxBuffer: MAX_OUTPUT_BYTES,
  });

  if (run.error !== undefined) {
    return 'code' in run.error && run.error.code === 'ENOENT'
      ? { kind: 'missing', program: scanner.program }
      : { kind: 'failure', reason: run.error.message };
  }

  if (run.status === null) {
    return { kind: 'failure', reason: `killed by ${ String(run.signal) }` };
  }

  if (run.status === 0) {
    return { kind: 'clean' };
  }

  if (run.status !== scanner.findingsExitCode) {
    const detail = `exit ${ String(run.status) }: ${ getFirstLine(run.stderr) }`;

    return { kind: 'failure', reason: detail };
  }

  const findings = readScannerReport(run.stdout);

  return 'violation' in findings
    ? { kind: 'failure', reason: findings.violation }
    : { kind: 'findings', findings };
}
