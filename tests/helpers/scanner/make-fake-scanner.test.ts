import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { CLEAN_ANSWER, makeFakeScanner } from './make-fake-scanner.ts';
import { withScanner } from './with-scanner.ts';

const SUBPROCESS_TIMEOUT_MS = 10000;

test('answers with its exit code, stdout and stderr', (t) => {
  const scanner = makeFakeScanner(t, { exitCode: 3, stdout: '[{}]\n', stderr: 'leaks\n' });

  const run = runScanner(scanner, ['git']);

  assert.deepEqual([run.status, run.stdout, run.stderr], [3, '[{}]\n', 'leaks\n']);
});

test('logs the arguments of each call on one line', (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  runScanner(scanner, ['git', '--log-opts=^a b']);
  runScanner(scanner, ['stdin']);

  assert.deepEqual(scanner.readCalls(), ['git --log-opts=^a b', 'stdin']);
});

function runScanner(scanner: Parameters<typeof withScanner>[1], args: readonly string[]) {
  return spawnSync('gitleaks', args, {
    encoding: 'utf8',
    env: withScanner(process.env, scanner),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
