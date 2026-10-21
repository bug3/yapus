import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readScanner, SCANNER_PATH } from '../../../../hooks/shared/scanner/read-scanner.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const BLOCK = 'blocked until the file is fixed';

test('reads the scanner description the hooks ship', async () => {
  assert.deepEqual(await readScanner(SCANNER_PATH), {
    program: 'gitleaks',
    commonArguments: [
      '--report-format',
      'json',
      '--report-path',
      '-',
      '--redact',
      '--no-banner',
      '--no-color',
      '--ignore-gitleaks-allow',
    ],
    configFile: 'gitleaks.toml',
    removedVariables: ['GITLEAKS_CONFIG', 'GITLEAKS_CONFIG_TOML'],
    findingsExitCode: 3,
    hookTimeoutSeconds: 20,
    hookSpawnSeconds: 25,
  });
});

test('refuses a missing file', async (t) => {
  const path = join(makeTempDir(t), 'missing.json');

  assert.deepEqual(await readScanner(path), { violation: `${ path } cannot be read; ${ BLOCK }` });
});

test('refuses a file that is not JSON', async (t) => {
  const path = writeScanner(t, '{');

  assert.deepEqual(await readScanner(path), { violation: `${ path } is not JSON; ${ BLOCK }` });
});

test('refuses a description whose limit is not a positive integer', async (t) => {
  const path = writeScanner(t, JSON.stringify({
    program: 'gitleaks',
    commonArguments: [],
    configFile: 'gitleaks.toml',
    removedVariables: [],
    findingsExitCode: 3,
    hookTimeoutSeconds: 0,
    hookSpawnSeconds: 25,
  }));

  assert.deepEqual(await readScanner(path), {
    violation: `${ path } is not a scanner description; ${ BLOCK }`,
  });
});

function writeScanner(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'scanner.json');

  writeFileSync(path, text);

  return path;
}
