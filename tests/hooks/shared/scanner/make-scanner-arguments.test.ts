import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  makeScannerArguments,
} from '../../../../hooks/shared/scanner/make-scanner-arguments.ts';
import type { Scanner } from '../../../../hooks/shared/scanner/read-scanner.ts';

const DIRECTORY = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'shared', 'scanner');
const SCANNER: Scanner = {
  program: 'scan',
  commonArguments: ['--quiet'],
  configFile: 'rules.toml',
  removedVariables: [],
  findingsExitCode: 7,
  hookTimeoutSeconds: 9,
  hookSpawnSeconds: 12,
};

test('puts the subcommand first, then the common arguments and the shipped settings', () => {
  assert.deepEqual(makeScannerArguments(SCANNER, ['stdin', '-x']), [
    'stdin',
    '-x',
    '--quiet',
    '--config',
    `${ DIRECTORY }/rules.toml`,
    '--gitleaks-ignore-path',
    DIRECTORY,
    '--exit-code',
    '7',
    '--timeout',
    '9',
  ]);
});
