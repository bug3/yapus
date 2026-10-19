import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { recordStart } from '../../../../../../hooks/claude/tyler/ashlar/state/record-start.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

test('writes the start time as an ISO string', (t) => {
  const dataDir = makeTempDir(t);

  recordStart(dataDir, 'session-1', new Date('2026-10-19T08:00:00.000Z'));

  assert.equal(
    readFileSync(join(dataDir, 'ashlar', 'session-1.start'), 'utf8'),
    '2026-10-19T08:00:00.000Z',
  );
});

test('keeps the first start time when the session starts again', (t) => {
  const dataDir = makeTempDir(t);

  recordStart(dataDir, 'session-1', new Date('2026-10-19T08:00:00.000Z'));
  recordStart(dataDir, 'session-1', new Date('2026-10-19T09:30:00.000Z'));

  assert.equal(
    readFileSync(join(dataDir, 'ashlar', 'session-1.start'), 'utf8'),
    '2026-10-19T08:00:00.000Z',
  );
});
