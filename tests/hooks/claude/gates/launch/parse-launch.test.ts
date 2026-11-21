import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLaunch } from '../../../../../hooks/claude/gates/launch/parse-launch.ts';

const MAIN_CALL = {
  session_id: 'abc-1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'delegator:reader', description: '[deep] Find x', prompt: 'p' },
};

test('reads a launch by the main agent', () => {
  assert.deepEqual(parseLaunch(JSON.stringify(MAIN_CALL)), {
    kind: 'launch',
    launch: {
      sessionId: 'abc-1',
      caller: undefined,
      subagentType: 'delegator:reader',
      description: '[deep] Find x',
      toolUseId: undefined,
      promptId: undefined,
      model: undefined,
      effort: undefined,
    },
  });
});

test('reads the join keys, the model override and the effort', () => {
  const parsed = parseLaunch(JSON.stringify({
    ...MAIN_CALL,
    tool_use_id: 'toolu_1',
    prompt_id: 'p1',
    effort: { level: 'high' },
    tool_input: { ...MAIN_CALL.tool_input, model: 'opus' },
  }));

  assert.ok(parsed.kind === 'launch');
  assert.deepEqual(
    [parsed.launch.toolUseId, parsed.launch.promptId, parsed.launch.model, parsed.launch.effort],
    ['toolu_1', 'p1', 'opus', 'high'],
  );
});

test('names the calling subagent of a nested launch by its type', () => {
  const parsed = parseLaunch(JSON.stringify({
    ...MAIN_CALL, agent_id: 'a1', agent_type: 'delegator:lead',
  }));

  assert.ok(parsed.kind === 'launch');
  assert.deepEqual(parsed.launch.caller, { agentId: 'a1', agentType: 'delegator:lead' });
});

test('reads a launch with agent_id and no agent_type as nested with the type unknown', () => {
  const parsed = parseLaunch(JSON.stringify({ ...MAIN_CALL, agent_id: 'a1' }));

  assert.ok(parsed.kind === 'launch');
  assert.deepEqual(parsed.launch.caller, { agentId: 'a1', agentType: undefined });
});

test('keeps the agent id of the calling subagent', () => {
  const parsed = parseLaunch(JSON.stringify({ ...MAIN_CALL, agent_id: 'a2' }));

  assert.ok(parsed.kind === 'launch');
  assert.equal(parsed.launch.caller?.agentId, 'a2');
});

test('reads a launch without subagent_type as general-purpose', () => {
  const parsed = parseLaunch(JSON.stringify({ ...MAIN_CALL, tool_input: { description: 'd' } }));

  assert.ok(parsed.kind === 'launch');
  assert.equal(parsed.launch.subagentType, 'general-purpose');
});

test('names stdin that is not JSON, another tool and a session id with a slash', () => {
  const reasons = [
    parseLaunch('{'),
    parseLaunch(JSON.stringify({ ...MAIN_CALL, tool_name: 'Read' })),
    parseLaunch(JSON.stringify({ ...MAIN_CALL, session_id: '../x' })),
  ];

  assert.deepEqual(reasons, [
    { kind: 'failure', reason: 'stdin is not JSON' },
    { kind: 'failure', reason: 'tool_name is not Agent' },
    { kind: 'failure', reason: 'session_id is not letters, digits and hyphens' },
  ]);
});

test('names a description that is not a string', () => {
  const stdinText = JSON.stringify({ ...MAIN_CALL, tool_input: { description: 3 } });

  assert.deepEqual(parseLaunch(stdinText), {
    kind: 'failure',
    reason: 'tool_input.subagent_type or tool_input.description is not a string',
  });
});
