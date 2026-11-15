import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readLimit } from '../../../../../hooks/claude/delegator/settings/read-limit.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('returns 41 by default when no limit file exists', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(readLimit(dataDir, 's1'), {
    kind: 'value',
    value: 41,
    source: 'default',
    path: join(dataDir, 'launch-limit'),
  });
});

test('returns the global limit, trimmed', (t) => {
  const dataDir = makeDataDir(t, '7\n', undefined);

  assert.deepEqual(readLimit(dataDir, 's1'), {
    kind: 'value',
    value: 7,
    source: 'global',
    path: join(dataDir, 'launch-limit'),
  });
});

test('returns the session limit over the global limit', (t) => {
  const dataDir = makeDataDir(t, '7', '0');

  assert.deepEqual(readLimit(dataDir, 's1'), {
    kind: 'value',
    value: 0,
    source: 'session',
    path: join(dataDir, 'sessions', 's1.launch-limit'),
  });
});

test('returns invalid with the session path for text that is not a whole number', (t) => {
  const dataDir = makeDataDir(t, '7', '-3');

  assert.deepEqual(
    readLimit(dataDir, 's1'),
    { kind: 'invalid', path: join(dataDir, 'sessions', 's1.launch-limit') },
  );
});

function makeDataDir(t: TestContext, globalText: string, sessionText: string | undefined): string {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'launch-limit'), globalText);

  if (sessionText !== undefined) {
    mkdirSync(join(dataDir, 'sessions'));
    writeFileSync(join(dataDir, 'sessions', 's1.launch-limit'), sessionText);
  }

  return dataDir;
}
