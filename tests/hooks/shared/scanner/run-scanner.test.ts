import assert from 'node:assert/strict';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { runScanner } from '../../../../hooks/shared/scanner/run-scanner.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import {
  CLEAN_ANSWER,
  type FakeAnswer,
  makeFakeScanner,
} from '../../../helpers/scanner/make-fake-scanner.ts';
import { makeToolDir } from '../../../helpers/scanner/make-tool-dir.ts';
import { withScanner } from '../../../helpers/scanner/with-scanner.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const SCANNER_DIRECTORY = join(ROOT, 'hooks', 'shared', 'scanner');
const REPORT = '[{"RuleID":"aws-access-token","File":"a.env","StartLine":4,"Secret":"REDACTED"}]';

test('calls the scanner with its subcommand, the common arguments and the limit', async (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  await scan(t, scanner, ['git', '--staged']);

  assert.deepEqual(scanner.readCalls(), [
    'git --staged --report-format json --report-path - --redact --no-banner --no-color'
    + ' --ignore-gitleaks-allow'
    + ` --config ${ SCANNER_DIRECTORY }/gitleaks.toml`
    + ` --gitleaks-ignore-path ${ SCANNER_DIRECTORY }`
    + ' --exit-code 3 --timeout 20',
  ]);
});

test('reads the shipped rules, not a config of the scanned repository', async (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  await scan(t, scanner, ['git', '--staged']);

  assert.match(scanner.readCalls().join(''), / --config \S+\/scanner\/gitleaks\.toml /);
});

test('reads no ignore file of the scanned repository', async (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  await scan(t, scanner, ['git', '--staged']);

  assert.match(scanner.readCalls().join(''), / --gitleaks-ignore-path \S+\/scanner /);
});

test('lets no inline allow comment hide a finding', async (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  await scan(t, scanner, ['git', '--staged']);

  assert.match(scanner.readCalls().join(''), / --ignore-gitleaks-allow /);
});

test('removes the variables that name another config and keeps the others', async (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);
  const env = withScanner({
    ...process.env,
    GITLEAKS_CONFIG: '/evil.toml',
    GITLEAKS_CONFIG_TOML: 'title = "evil"',
    GITLEAKS_LOG_LEVEL: 'debug',
  }, scanner);

  await runScanner({ subcommand: ['git'], cwd: makeTempDir(t), env });

  assert.deepEqual(scanner.readVariables(), ['GITLEAKS_LOG_LEVEL=debug']);
});

test('reports a scan that exits 0 as clean', async (t) => {
  const outcome = await scanWith(t, CLEAN_ANSWER);

  assert.deepEqual(outcome, { kind: 'clean' });
});

test('reports exit 3 with a report as its findings', async (t) => {
  const outcome = await scanWith(t, { exitCode: 3, stdout: REPORT, stderr: '' });

  assert.deepEqual(outcome, {
    kind: 'findings',
    findings: [{ ruleId: 'aws-access-token', file: 'a.env', startLine: 4 }],
  });
});

test('reports exit 3 with a report it cannot read as a failure', async (t) => {
  const outcome = await scanWith(t, { exitCode: 3, stdout: 'not json', stderr: '' });

  assert.deepEqual(outcome, { kind: 'failure', reason: 'the report is not JSON' });
});

test('reports any other exit as a failure with the first line of stderr', async (t) => {
  const outcome = await scanWith(t, { exitCode: 1, stdout: '', stderr: 'bad flag\nusage\n' });

  assert.deepEqual(outcome, { kind: 'failure', reason: 'exit 1: bad flag' });
});

test('reports a scanner that is not on PATH as missing', async (t) => {
  const outcome = await runScanner({
    subcommand: ['git', '--staged'],
    cwd: makeTempDir(t),
    env: { PATH: makeToolDir(t, []) },
  });

  assert.deepEqual(outcome, { kind: 'missing', program: 'gitleaks' });
});

function scanWith(t: TestContext, answer: FakeAnswer) {
  return scan(t, makeFakeScanner(t, answer), ['git', '--staged']);
}

function scan(
  t: TestContext,
  scanner: ReturnType<typeof makeFakeScanner>,
  subcommand: readonly string[],
) {
  return runScanner({
    subcommand,
    cwd: makeTempDir(t),
    env: withScanner(process.env, scanner),
  });
}
