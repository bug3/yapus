import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getOutcome } from '../../../../../hooks/claude/delegator/resume/get-outcome.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const RESUMED = JSON.stringify({
  session_id: 's1',
  tool_name: 'SendMessage',
  tool_input: { to: 'a1', summary: 'Follow-up', message: 'Reply with the single word OK.' },
  tool_response: {
    success: true,
    message: 'Resuming agent a1',
    resumedAgentId: 'a1',
    revivedAgentId: 'a1',
    pin: { id: 'a1', name: 'a1', ref: 'a07ebb' },
  },
  tool_use_id: 'toolu_1',
});
const QUEUED = JSON.stringify({
  session_id: 's1',
  tool_name: 'SendMessage',
  tool_input: { to: 'a2', summary: 'Follow-up', message: 'Add PING.' },
  tool_response: {
    success: true,
    message: 'Message queued for delivery to a2 at its next tool round.',
    pin: { id: 'a2', name: 'a2', ref: '6760eb' },
  },
  tool_use_id: 'toolu_2',
});

test('records a resume as one resume row', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getOutcome({ stdinText: RESUMED, dataDir, time: 't' }), { kind: 'recorded' });
  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"resume","sessionId":"s1","agentId":"a1","toolUseId":"toolu_1"}\n',
  );
});

test('skips a queued message without a row', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getOutcome({ stdinText: QUEUED, dataDir, time: 't' }), { kind: 'skipped' });
  assert.equal(existsSync(join(dataDir, 'decisions.jsonl')), false);
});

test('fails without a row when the plugin data directory is unset or empty', () => {
  const outcomes = [
    getOutcome({ stdinText: RESUMED, dataDir: undefined, time: 't' }),
    getOutcome({ stdinText: RESUMED, dataDir: '', time: 't' }),
  ];
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin',
  };

  assert.deepEqual(outcomes, [failure, failure]);
});

test('fails without a row on stdin it cannot read', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getOutcome({ stdinText: '{', dataDir, time: 't' }), {
    kind: 'failure',
    detail: 'stdin is not JSON; the resume is not recorded',
  });
  assert.equal(existsSync(join(dataDir, 'decisions.jsonl')), false);
});
