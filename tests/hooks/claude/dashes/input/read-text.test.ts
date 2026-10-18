import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readText } from '../../../../../hooks/claude/dashes/input/read-text.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('reads the text of a file', async (t) => {
  const filePath = join(makeTempDir(t), 'a.md');

  writeFileSync(filePath, 'a\nb\n');

  assert.equal(await readText(filePath), 'a\nb\n');
});

test('reads a missing file as absent', async (t) => {
  assert.equal(await readText(join(makeTempDir(t), 'missing.md')), undefined);
});
