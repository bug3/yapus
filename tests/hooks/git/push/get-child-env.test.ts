import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChildEnv } from '../../../../hooks/git/push/get-child-env.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const PATH = process.env.PATH ?? '';
const LIMIT_MS = 10000;

test('drops the variables that tie git to a repository', (t) => {
  const env = {
    PATH,
    GIT_DIR: '/outer/.git',
    GIT_INDEX_FILE: '/outer/.git/index',
    GIT_CONFIG_COUNT: '1',
  };

  assert.deepEqual(getChildEnv(env, makeTempDir(t), LIMIT_MS), { PATH });
});

test('keeps a git variable a caller sets on purpose', (t) => {
  const env = { PATH, GIT_CONFIG_GLOBAL: '/dev/null' };

  assert.deepEqual(getChildEnv(env, makeTempDir(t), LIMIT_MS), env);
});
