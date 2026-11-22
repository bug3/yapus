import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEnvWithoutCompileCache } from './get-env-without-compile-cache.ts';

test('drops NODE_COMPILE_CACHE and keeps the other variables', () => {
  const env = getEnvWithoutCompileCache({ NODE_COMPILE_CACHE: '/cache', PATH: '/usr/bin' });

  assert.deepEqual(env, { PATH: '/usr/bin' });
});
