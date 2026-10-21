import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeFakeScanner, CLEAN_ANSWER } from './make-fake-scanner.ts';
import { withScanner } from './with-scanner.ts';

test('puts the scanner directory first on PATH and keeps the rest', (t) => {
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  const env = withScanner({ PATH: '/usr/bin', HOME: '/home' }, scanner);

  assert.deepEqual(env, { PATH: `${ scanner.directory }:/usr/bin`, HOME: '/home' });
});
