import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanStagedChange } from '../../../../hooks/git/commit/scan-staged-change.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { CLEAN_ANSWER, makeFakeScanner } from '../../../helpers/scanner/make-fake-scanner.ts';
import { withScanner } from '../../../helpers/scanner/with-scanner.ts';

test('asks the scanner for the staged change and clears a clean scan', async (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  const verdict = await scanStagedChange(makeTempDir(t), withScanner(process.env, scanner));

  assert.deepEqual(verdict, { warnings: [], violations: [] });
  assert.match(scanner.readCalls().join('\n'), /^git --staged --report-format json /);
});
