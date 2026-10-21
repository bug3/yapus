import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Scanner } from '../../../../hooks/shared/scanner/read-scanner.ts';
import {
  removeScannerVariables,
} from '../../../../hooks/shared/scanner/remove-scanner-variables.ts';

const SCANNER: Scanner = {
  program: 'scan',
  commonArguments: [],
  configFile: 'rules.toml',
  removedVariables: ['SCAN_CONFIG'],
  findingsExitCode: 3,
  hookTimeoutSeconds: 1,
  hookSpawnSeconds: 2,
};

test('removes the named variables and keeps the others', () => {
  const env = { SCAN_CONFIG: '/evil.toml', SCAN_LOG: 'debug', PATH: '/bin' };

  assert.deepEqual(removeScannerVariables(SCANNER, env), { SCAN_LOG: 'debug', PATH: '/bin' });
});
