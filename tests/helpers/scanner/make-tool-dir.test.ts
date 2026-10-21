import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeToolDir } from './make-tool-dir.ts';

test('holds the named tools and nothing else', (t) => {
  const directory = makeToolDir(t, ['git', 'node']);

  assert.deepEqual(readdirSync(directory).sort(), ['git', 'node']);
});

test('runs the real tool through its script', (t) => {
  const directory = makeToolDir(t, ['node']);

  const run = spawnSync(join(directory, 'node'), ['-p', '6 * 7'], { encoding: 'utf8' });

  assert.deepEqual([run.status, run.stdout], [0, '42\n']);
});
