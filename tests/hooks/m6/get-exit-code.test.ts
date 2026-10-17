import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getExitCode } from '../../../hooks/m6/get-exit-code.ts';

test('lets the call through with no message', () => {
  assert.equal(getExitCode([]), 0);
});

test('blocks the call with a message', () => {
  assert.equal(getExitCode(['yapus m6: /r/a.md:1: U+2014; use the ASCII hyphen']), 2);
});
