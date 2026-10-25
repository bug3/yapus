import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readMode } from '../../../../../hooks/claude/providens/settings/read-mode.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('returns on by default when no mode file exists', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(readMode(dataDir, 's1'), { kind: 'value', value: 'on', source: 'default' });
});

test('returns the global mode, trimmed', (t) => {
  const dataDir = makeDataDir(t, 'off\n', undefined);

  assert.deepEqual(readMode(dataDir, 's1'), { kind: 'value', value: 'off', source: 'global' });
});

test('returns the session mode over the global mode', (t) => {
  const dataDir = makeDataDir(t, 'off', 'on');

  assert.deepEqual(readMode(dataDir, 's1'), { kind: 'value', value: 'on', source: 'session' });
});

test('returns invalid with the session path for a word that is not a mode', (t) => {
  const dataDir = makeDataDir(t, 'off', 'ON');

  assert.deepEqual(
    readMode(dataDir, 's1'),
    { kind: 'invalid', path: join(dataDir, 'sessions', 's1.mode') },
  );
});

test('returns invalid with the global path for an empty file', (t) => {
  const dataDir = makeDataDir(t, '\n', undefined);

  assert.deepEqual(readMode(dataDir, 's1'), { kind: 'invalid', path: join(dataDir, 'mode') });
});

function makeDataDir(t: TestContext, globalText: string, sessionText: string | undefined): string {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'mode'), globalText);

  if (sessionText !== undefined) {
    mkdirSync(join(dataDir, 'sessions'));
    writeFileSync(join(dataDir, 'sessions', 's1.mode'), sessionText);
  }

  return dataDir;
}
