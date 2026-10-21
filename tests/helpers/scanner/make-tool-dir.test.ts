import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { makeToolDir } from './make-tool-dir.ts';

test('links the named tools and nothing else', (t) => {
  const directory = makeToolDir(t, ['git', 'node']);

  assert.deepEqual(readdirSync(directory).sort(), ['git', 'node']);
});
