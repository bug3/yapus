import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLaunch } from '../../../../../hooks/claude/tyler/launch/parse-launch.ts';

const MAIN_CALL = {
  session_id: 'abc-1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'providens:deacon', description: '[deep] Find x', prompt: 'p' },
};

test('reads a launch from the main session', () => {
  assert.deepEqual(parseLaunch(JSON.stringify(MAIN_CALL)), {
    kind: 'launch',
    launch: {
      sessionId: 'abc-1',
      isNested: false,
      subagentType: 'providens:deacon',
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

test('marks a launch from inside a subagent as nested', () => {
  const parsed = parseLaunch(JSON.stringify({ ...MAIN_CALL, agent_id: 'a1' }));

  assert.ok(parsed.kind === 'launch');
  assert.equal(parsed.launch.isNested, true);
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
