import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  isAccepted,
} from '../../../../../../hooks/claude/tyler/ashlar/state/is-accepted.ts';
import {
  recordAcceptance,
} from '../../../../../../hooks/claude/tyler/ashlar/state/record-acceptance.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

const ACCEPTANCE = { time: '2026-10-19T10:00:00Z', agentId: 'agent-1', base: 'aaa', tree: 'bbb' };

test('is false when no file exists', (t) => {
  assert.equal(isAccepted(makeTempDir(t), 'session-1', { base: 'aaa', tree: 'bbb' }), false);
});

test('is true for a recorded range', (t) => {
  const dataDir = makeTempDir(t);

  recordAcceptance(dataDir, 'session-1', ACCEPTANCE);

  assert.equal(isAccepted(dataDir, 'session-1', { base: 'aaa', tree: 'bbb' }), true);
});

test('is false for the same tree with another base', (t) => {
  const dataDir = makeTempDir(t);

  recordAcceptance(dataDir, 'session-1', ACCEPTANCE);

  assert.equal(isAccepted(dataDir, 'session-1', { base: 'zzz', tree: 'bbb' }), false);
});

test('is false for the same base with another tree', (t) => {
  const dataDir = makeTempDir(t);

  recordAcceptance(dataDir, 'session-1', ACCEPTANCE);

  assert.equal(isAccepted(dataDir, 'session-1', { base: 'aaa', tree: 'zzz' }), false);
});

test('skips a garbage line before a matching line', (t) => {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'ashlar'));
  writeFileSync(
    join(dataDir, 'ashlar', 'session-1.jsonl'),
    `not json\n${ JSON.stringify(ACCEPTANCE) }\n`,
  );

  assert.equal(isAccepted(dataDir, 'session-1', { base: 'aaa', tree: 'bbb' }), true);
});
