import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseResume } from '../../../../../hooks/claude/providens/resume/parse-resume.ts';

const RESUMED = {
  session_id: 's1',
  hook_event_name: 'PostToolUse',
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
};
const QUEUED = {
  ...RESUMED,
  tool_response: {
    success: true,
    message: 'Message queued for delivery to a2 at its next tool round.',
    pin: { id: 'a2', name: 'a2', ref: '6760eb' },
  },
};

test('reads a resume with the session, the resumed agent and the call', () => {
  assert.deepEqual(parseResume(JSON.stringify(RESUMED)), {
    kind: 'resume',
    resume: { sessionId: 's1', agentId: 'a1', toolUseId: 'toolu_1' },
  });
});

test('reads a message without resumedAgentId as none', () => {
  assert.deepEqual(parseResume(JSON.stringify(QUEUED)), { kind: 'none' });
});

test('fails on stdin that is not JSON or not an object', () => {
  assert.deepEqual(parseResume('{'), { kind: 'failure', reason: 'stdin is not JSON' });
  assert.deepEqual(parseResume('[]'), { kind: 'failure', reason: 'stdin is not a JSON object' });
});

test('fails on another tool_name', () => {
  assert.deepEqual(parseResume(JSON.stringify({ ...RESUMED, tool_name: 'Agent' })), {
    kind: 'failure',
    reason: 'tool_name is not SendMessage',
  });
});

test('fails on an unsafe session_id or resumedAgentId', () => {
  const unsafeSession = { ...RESUMED, session_id: '../x' };
  const unsafeAgent = {
    ...RESUMED,
    tool_response: { ...RESUMED.tool_response, resumedAgentId: 'a/1' },
  };

  assert.deepEqual(parseResume(JSON.stringify(unsafeSession)), {
    kind: 'failure',
    reason: 'session_id is not letters, digits and hyphens',
  });
  assert.deepEqual(parseResume(JSON.stringify(unsafeAgent)), {
    kind: 'failure',
    reason: 'tool_response.resumedAgentId is not letters, digits and hyphens',
  });
});

test('fails on a tool_input, tool_response or tool_use_id of the wrong type', () => {
  const noInput = { ...RESUMED, tool_input: 'x' };
  const noResponse = { ...RESUMED, tool_response: 'x' };
  const noCall = { ...RESUMED, tool_use_id: 1 };

  assert.deepEqual(parseResume(JSON.stringify(noInput)), {
    kind: 'failure',
    reason: 'tool_input or tool_response is not a JSON object',
  });
  assert.deepEqual(parseResume(JSON.stringify(noResponse)), {
    kind: 'failure',
    reason: 'tool_input or tool_response is not a JSON object',
  });
  assert.deepEqual(parseResume(JSON.stringify(noCall)), {
    kind: 'failure',
    reason: 'tool_use_id is not a string',
  });
});
