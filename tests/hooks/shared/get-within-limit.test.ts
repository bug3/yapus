import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWithinLimit } from '../../../hooks/shared/get-within-limit.ts';

const LIMIT_SECONDS = 0.02;

test('gives the result of work that ends within the limit', async () => {
  assert.equal(await getWithinLimit(Promise.resolve('done'), LIMIT_SECONDS), 'done');
});

test('gives undefined for work that does not end within the limit', async () => {
  const work = new Promise<string>(() => undefined);

  assert.equal(await getWithinLimit(work, LIMIT_SECONDS), undefined);
});

test('rejects when the work rejects within the limit', async () => {
  await assert.rejects(getWithinLimit(Promise.reject(new Error('boom')), LIMIT_SECONDS), {
    message: 'boom',
  });
});

test('clears the timer once the work ends', async (t) => {
  const clearTimeoutSpy = t.mock.method(globalThis, 'clearTimeout');

  await getWithinLimit(Promise.resolve('done'), LIMIT_SECONDS);

  assert.equal(clearTimeoutSpy.mock.callCount(), 1);
});
