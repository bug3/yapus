import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  recordAcceptance,
} from '../../../../../../hooks/claude/tyler/ashlar/state/record-acceptance.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

const ACCEPTANCE = { time: '2026-10-19T10:00:00Z', agentId: 'agent-1', base: 'aaa', tree: 'bbb' };
const OTHER = { time: '2026-10-19T10:05:00Z', agentId: 'agent-1', base: 'aaa', tree: 'ccc' };

test('writes one parseable line for one call', (t) => {
  const dataDir = makeTempDir(t);

  recordAcceptance(dataDir, 'session-1', ACCEPTANCE);

  const text = readFileSync(join(dataDir, 'ashlar', 'session-1.jsonl'), 'utf8');

  assert.equal(text, `${ JSON.stringify(ACCEPTANCE) }\n`);
});

test('appends a second line for a second call', (t) => {
  const dataDir = makeTempDir(t);

  recordAcceptance(dataDir, 'session-1', ACCEPTANCE);
  recordAcceptance(dataDir, 'session-1', OTHER);

  const text = readFileSync(join(dataDir, 'ashlar', 'session-1.jsonl'), 'utf8');

  assert.equal(text, `${ JSON.stringify(ACCEPTANCE) }\n${ JSON.stringify(OTHER) }\n`);
});
