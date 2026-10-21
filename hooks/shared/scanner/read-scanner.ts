import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isRecord } from '../is-record.ts';

export const SCANNER_PATH = join(import.meta.dirname, 'scanner.json');

// How the git hooks call the secret scanner. The program is found on PATH.
export interface Scanner {
  readonly program: string;
  // The arguments every use shares, after its own subcommand and arguments.
  readonly commonArguments: readonly string[];
  // The rules file beside scanner.json. The scanned repository must not
  // weaken the scan: its own config, its ignore file and its inline allow
  // comments are not read, and these variables are removed from the
  // environment, since they could name another config.
  readonly configFile: string;
  readonly removedVariables: readonly string[];
  // The exit code that means findings; 0 means none, any other a failure.
  readonly findingsExitCode: number;
  // The scanner's own limit and the longer limit the hook puts on its process.
  readonly hookTimeoutSeconds: number;
  readonly hookSpawnSeconds: number;
}

export interface ScannerViolation {
  readonly violation: string;
}

export async function readScanner(path: string): Promise<Scanner | ScannerViolation> {
  let scannerText: string;

  try {
    scannerText = await readFile(path, 'utf8');
  } catch {
    return makeViolation(path, 'cannot be read');
  }

  let scanner: unknown;

  try {
    scanner = JSON.parse(scannerText);
  } catch {
    return makeViolation(path, 'is not JSON');
  }

  return isScanner(scanner) ? scanner : makeViolation(path, 'is not a scanner description');
}

function isScanner(candidate: unknown): candidate is Scanner {
  return isRecord(candidate)
    && typeof candidate.program === 'string' && candidate.program !== ''
    && Array.isArray(candidate.commonArguments)
    && candidate.commonArguments.every((argument) => typeof argument === 'string')
    && typeof candidate.configFile === 'string' && candidate.configFile !== ''
    && Array.isArray(candidate.removedVariables)
    && candidate.removedVariables.every((name) => typeof name === 'string')
    && isPositiveInteger(candidate.findingsExitCode)
    && isPositiveInteger(candidate.hookTimeoutSeconds)
    && isPositiveInteger(candidate.hookSpawnSeconds);
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function makeViolation(path: string, reason: string): ScannerViolation {
  return { violation: `${ path } ${ reason }; blocked until the file is fixed` };
}
