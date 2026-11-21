import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStop } from '../../../../../hooks/claude/gates/return/parse-stop.ts';

const FIELDS = {
  session_id: 's1',
  agent_type: 'delegator:reader',
  last_assistant_message: 'DONE',
};

test('reads a stop without stop_hook_active as a first stop', () => {
  assert.deepEqual(parseStop(JSON.stringify(FIELDS)), {
    kind: 'stop',
    stop: {
      sessionId: 's1',
      agentType: 'delegator:reader',
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

test('reads a stop without its message as a stop of no message', () => {
  const parsed = parseStop(JSON.stringify({ session_id: 's1', agent_type: 'delegator:reader' }));

  assert.ok(parsed.kind === 'stop');
  assert.equal(parsed.stop.message, undefined);
});

test('names stdin that is not JSON and a stop without its agent type', () => {
  const noAgentType = { session_id: 's1', last_assistant_message: 'DONE' };

  assert.deepEqual([parseStop('{'), parseStop(JSON.stringify(noAgentType))], [
    { kind: 'failure', reason: 'stdin is not JSON' },
    {
      kind: 'failure',
      reason: 'agent_type, last_assistant_message or stop_hook_active is missing',
    },
  ]);
});

test('names a stop whose message is not a text', () => {
  const parsed = parseStop(JSON.stringify({ ...FIELDS, last_assistant_message: 7 }));

  assert.deepEqual(parsed, {
    kind: 'failure',
    reason: 'agent_type, last_assistant_message or stop_hook_active is missing',
  });
});
