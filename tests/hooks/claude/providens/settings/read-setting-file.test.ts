import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  readSettingFile,
} from '../../../../../hooks/claude/providens/settings/read-setting-file.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('returns the parsed value of the trimmed text', (t) => {
  const path = join(makeTempDir(t), 'setting');

  writeFileSync(path, '  on\n');

  assert.deepEqual(readSettingFile(path, parseWord), { kind: 'value', value: 'on' });
});

test('returns missing when the file does not exist', (t) => {
  const path = join(makeTempDir(t), 'setting');

  assert.deepEqual(readSettingFile(path, parseWord), { kind: 'missing' });
});

test('returns invalid when parse finds nothing', (t) => {
  const path = join(makeTempDir(t), 'setting');

  writeFileSync(path, ' \n');

  assert.deepEqual(readSettingFile(path, parseWord), { kind: 'invalid' });
});

function parseWord(text: string): string | undefined {
  return text === '' ? undefined : text;
}
