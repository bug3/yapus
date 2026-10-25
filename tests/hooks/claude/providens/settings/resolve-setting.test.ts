import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  getSettingPath,
  resolveSetting,
  type Setting,
} from '../../../../../hooks/claude/providens/settings/resolve-setting.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const WORD: Setting<string> = { name: 'word', parse: parseWord, fallback: 'fallback' };

function parseWord(text: string): string | undefined {
  return text === '' ? undefined : text;
}

test('returns the session file over the global file', (t) => {
  const dataDir = makeDataDir(t, 'global-word', 'session-word');

  assert.deepEqual(
    resolveSetting(dataDir, 's1', WORD),
    {
      kind: 'value',
      value: 'session-word',
      source: 'session',
      path: join(dataDir, 'sessions', 's1.word'),
    },
  );
});

test('returns the global file when the session has none', (t) => {
  const dataDir = makeDataDir(t, 'global-word', undefined);

  assert.deepEqual(
    resolveSetting(dataDir, 's1', WORD),
    { kind: 'value', value: 'global-word', source: 'global', path: join(dataDir, 'word') },
  );
});

test('returns the fallback when no file exists', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(
    resolveSetting(dataDir, 's1', WORD),
    { kind: 'value', value: 'fallback', source: 'default', path: join(dataDir, 'word') },
  );
});

test('returns invalid with the session path and skips the global file', (t) => {
  const dataDir = makeDataDir(t, 'global-word', ' \n');

  assert.deepEqual(
    resolveSetting(dataDir, 's1', WORD),
    { kind: 'invalid', path: join(dataDir, 'sessions', 's1.word') },
  );
});

test('returns invalid with the global path when the session has none', (t) => {
  const dataDir = makeDataDir(t, ' \n', undefined);

  assert.deepEqual(
    resolveSetting(dataDir, 's1', WORD),
    { kind: 'invalid', path: join(dataDir, 'word') },
  );
});

test('gives the session path with an id and the global path without', (t) => {
  const dataDir = makeTempDir(t);

  assert.equal(getSettingPath(dataDir, 'word', 's1'), join(dataDir, 'sessions', 's1.word'));
  assert.equal(getSettingPath(dataDir, 'word'), join(dataDir, 'word'));
});

function makeDataDir(t: TestContext, globalText: string, sessionText: string | undefined): string {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'word'), globalText);

  if (sessionText !== undefined) {
    mkdirSync(join(dataDir, 'sessions'));
    writeFileSync(join(dataDir, 'sessions', 's1.word'), sessionText);
  }

  return dataDir;
}
