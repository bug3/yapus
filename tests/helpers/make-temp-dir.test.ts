import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { makeTempDir } from './make-temp-dir.ts';

test('makes an empty directory under the system temp directory', (t) => {
  const tempDir = makeTempDir(t);

  assert.deepEqual([tempDir.startsWith(tmpdir()), readdirSync(tempDir)], [true, []]);
});

test('removes the directory when the test that made it ends', async (t) => {
  let tempDir = '';

  await t.test('makes the directory', (subtest) => {
    tempDir = makeTempDir(subtest);
  });

  assert.equal(existsSync(tempDir), false);
});
