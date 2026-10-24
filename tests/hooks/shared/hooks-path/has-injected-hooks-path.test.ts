import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasInjectedHooksPath,
} from '../../../../hooks/shared/hooks-path/has-injected-hooks-path.ts';

test('finds a plain injection', () => {
  assert.equal(
    hasInjectedHooksPath({
      GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_KEY_1: 'core.hooksPath',
    }),
    true,
  );
});

test('finds a key in another letter case', () => {
  assert.equal(
    hasInjectedHooksPath({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'Core.HooksPath' }),
    true,
  );
});

test('finds the key whatever the count is or whether it is set', () => {
  const key = { GIT_CONFIG_KEY_0: 'core.hooksPath' };

  assert.deepEqual(
    [{ GIT_CONFIG_COUNT: '-1' }, { GIT_CONFIG_COUNT: '999999999999' },
      { GIT_CONFIG_COUNT: ' 1 ' }, {}]
      .map((count) => hasInjectedHooksPath({ ...count, ...key })),
    [true, true, true, true],
  );
});

test('finds nothing without a key that names core.hooksPath', () => {
  assert.deepEqual(
    [
      hasInjectedHooksPath({}),
      hasInjectedHooksPath({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'user.name' }),
      hasInjectedHooksPath({ GIT_CONFIG_VALUE_0: 'core.hooksPath' }),
    ],
    [false, false, false],
  );
});
