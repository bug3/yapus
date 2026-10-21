import { dirname, join } from 'node:path';
import { SCANNER_PATH, type Scanner } from './read-scanner.ts';

// The arguments of one scanner call: the use's own subcommand and arguments, the
// common arguments, the shipped rules, the scanner's own directory as the ignore
// path, the findings exit code and the scanner's own limit.
export function makeScannerArguments(scanner: Scanner, subcommand: readonly string[]): string[] {
  const scannerDirectory = dirname(SCANNER_PATH);

  return [
    ...subcommand,
    ...scanner.commonArguments,
    '--config',
    join(scannerDirectory, scanner.configFile),
    // The scanner's own directory holds no .gitleaksignore.
    '--gitleaks-ignore-path',
    scannerDirectory,
    '--exit-code',
    String(scanner.findingsExitCode),
    '--timeout',
    String(scanner.hookTimeoutSeconds),
  ];
}
