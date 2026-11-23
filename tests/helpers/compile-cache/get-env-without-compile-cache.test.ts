import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEnvWithoutCompileCache } from './get-env-without-compile-cache.ts';

test('drops NODE_COMPILE_CACHE and keeps the other variables', () => {
  const env = getEnvWithoutCompileCache({ NODE_COMPILE_CACHE: '/cache', PATH: '/usr/bin' });

  assert.deepEqual(env, { PATH: '/usr/bin' });
});

test('leaves the given environment unchanged', () => {
  const given = { NODE_COMPILE_CACHE: '/cache', PATH: '/usr/bin' };

  getEnvWithoutCompileCache(given);

  assert.deepEqual(given, { NODE_COMPILE_CACHE: '/cache', PATH: '/usr/bin' });
});

test('returns the same variables when NODE_COMPILE_CACHE is absent', () => {
  const env = getEnvWithoutCompileCache({ PATH: '/usr/bin' });

  assert.deepEqual(env, { PATH: '/usr/bin' });
});
