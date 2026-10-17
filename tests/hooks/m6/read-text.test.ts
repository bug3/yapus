import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readText } from '../../../hooks/m6/read-text.ts';
import { makeTempDir } from '../../support/make-temp-dir.ts';

test('reads the text of a file', async (t) => {
  const filePath = join(makeTempDir(t), 'a.md');

  writeFileSync(filePath, 'a\nb\n');

  assert.equal(await readText(filePath), 'a\nb\n');
});

test('reads a missing file as absent', async (t) => {
  assert.equal(await readText(join(makeTempDir(t), 'missing.md')), undefined);
});
