import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEnd } from '../../../../../hooks/claude/delegator/end/parse-end.ts';

const CAP_NOTE = 'NOTE: this agent stopped at its 15-turn limit before finishing. It was still '
  + 'calling tools and had produced no report.\n';
const COMPLETED = {
  session_id: 's1',
  prompt_id: 'p1',
  tool_name: 'Agent',
  tool_use_id: 'toolu_1',
  tool_input: { subagent_type: 'delegator:runner', description: '[standard] run it' },
  tool_response: {
    status: 'completed',
    agentId: 'a1',
    agentType: 'delegator:runner',
    content: [{ type: 'text', text: 'DONE\n\nCommand: echo ok\n' }],
    resolvedModel: 'claude-haiku-5-5',
    totalDurationMs: 4018,
    totalTokens: 4832,
    totalToolUseCount: 1,
  },
};
const LAUNCHED = {
  ...COMPLETED,
  tool_response: { isAsync: true, status: 'async_launched', agentId: 'a2' },
};

test('reads a completed launch with its totals and the first word of the return', () => {
  assert.deepEqual(parseEnd(JSON.stringify(COMPLETED)), {
    kind: 'end',
    end: {
      sessionId: 's1',
      promptId: 'p1',
      toolUseId: 'toolu_1',
      agentType: 'delegator:runner',
      agentId: 'a1',
      status: 'completed',
      model: 'claude-haiku-5-5',
      outputFile: undefined,
      durationMs: 4018,
      tokens: 4832,
      toolUses: 1,
      word: 'DONE',
      length: 23,
      isCapped: false,
    },
  });
});

test('reads a background launch without totals or text', () => {
  const parsed = parseEnd(JSON.stringify(LAUNCHED));

  assert.ok(parsed.kind === 'end');
  assert.deepEqual(
    [parsed.end.status, parsed.end.agentId, parsed.end.durationMs, parsed.end.word],
    ['async_launched', 'a2', undefined, undefined],
  );
});

test('reads the output file of a background launch, and none that is no string', () => {
  const outputFiles = ['/tasks/a2.output', 7].map((outputFile) => {
    const response = { ...LAUNCHED.tool_response, outputFile };
    const parsed = parseEnd(JSON.stringify({ ...LAUNCHED, tool_response: response }));

    return parsed.kind === 'end' ? parsed.end.outputFile : parsed.reason;
  });

  assert.deepEqual(outputFiles, ['/tasks/a2.output', undefined]);
});

test('marks a launch that ended on the turn-limit note as capped', () => {
  const response = { ...COMPLETED.tool_response, content: [{ type: 'text', text: CAP_NOTE }] };
  const parsed = parseEnd(JSON.stringify({ ...COMPLETED, tool_response: response }));

  assert.ok(parsed.kind === 'end');
  assert.deepEqual([parsed.end.isCapped, parsed.end.word], [true, 'NOTE:']);
});

test('reads a launch without subagent_type as general-purpose', () => {
  const parsed = parseEnd(JSON.stringify({ ...COMPLETED, tool_input: { description: 'd' } }));

  assert.ok(parsed.kind === 'end');
  assert.equal(parsed.end.agentType, 'general-purpose');
});

test('names stdin that is not JSON, another tool and a response without an agent id', () => {
  const reasons = [
    parseEnd('{'),
    parseEnd(JSON.stringify({ ...COMPLETED, tool_name: 'Read' })),
    parseEnd(JSON.stringify({ ...COMPLETED, tool_response: { status: 'completed' } })),
  ];

  assert.deepEqual(reasons, [
    { kind: 'failure', reason: 'stdin is not JSON' },
    { kind: 'failure', reason: 'tool_name is not Agent' },
    {
      kind: 'failure',
      reason: 'tool_input.subagent_type, tool_response.agentId or tool_response.status '
        + 'is not a string',
    },
  ]);
});
