import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStop } from '../../../../../hooks/claude/tyler/return/parse-stop.ts';

const FIELDS = {
  session_id: 's1',
  agent_type: 'providens:deacon',
  last_assistant_message: 'DONE',
};

test('reads a stop without stop_hook_active as a first stop', () => {
  assert.deepEqual(parseStop(JSON.stringify(FIELDS)), {
    kind: 'stop',
    stop: {
      sessionId: 's1',
      agentType: 'providens:deacon',
      message: 'DONE',
      isRetry: false,
      agentId: undefined,
      transcriptPath: undefined,
    },
  });
});

test('reads the agent id when the payload carries it', () => {
  const parsed = parseStop(JSON.stringify({ ...FIELDS, agent_id: 'a1' }));

  assert.ok(parsed.kind === 'stop');
  assert.equal(parsed.stop.agentId, 'a1');
});

test('reads the transcript path when the payload carries it', () => {
  const path = '/tmp/x/agent-a1.jsonl';
  const withPath = parseStop(JSON.stringify({ ...FIELDS, agent_transcript_path: path }));
  const without = parseStop(JSON.stringify(FIELDS));

  assert.ok(withPath.kind === 'stop' && without.kind === 'stop');
  assert.deepEqual(
    [withPath.stop.transcriptPath, without.stop.transcriptPath],
    [path, undefined],
  );
});

test('reads a stop with stop_hook_active as a retry', () => {
  const parsed = parseStop(JSON.stringify({ ...FIELDS, stop_hook_active: true }));

  assert.ok(parsed.kind === 'stop');
  assert.equal(parsed.stop.isRetry, true);
});

test('names stdin that is not JSON and a stop without its message', () => {
  const noMessage = { session_id: 's1', agent_type: 'providens:deacon' };

  assert.deepEqual([parseStop('{'), parseStop(JSON.stringify(noMessage))], [
    { kind: 'failure', reason: 'stdin is not JSON' },
    {
      kind: 'failure',
      reason: 'agent_type, last_assistant_message or stop_hook_active is missing',
    },
  ]);
});
