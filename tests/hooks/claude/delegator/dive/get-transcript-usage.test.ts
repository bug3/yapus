import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getTranscriptUsage,
} from '../../../../../hooks/claude/delegator/dive/get-transcript-usage.ts';

// 2026-01-01T00:00:00.000Z
const MIDNIGHT_MS = 1767225600000;
const NO_USAGE = {
  turns: 0,
  outputTokens: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  firstMs: undefined,
  lastMs: undefined,
  models: [],
  tools: {},
  toolsNotHeld: {},
};
// The answer of Claude Code 2.1.330 to a call of Bash by an agent without it.
const NOT_HELD_ANSWER =
  '<tool_use_error>Error: No such tool available: Bash. Bash is not among the tools available here. Continue with the tools you have.</tool_use_error>';
const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_creation_input_tokens: 100,
  cache_read_input_tokens: 200,
};

function toText(...lines: readonly unknown[]): string {
  return lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n');
}

function makeResponse(id: string, message: Readonly<Record<string, unknown>>): unknown {
  return { type: 'assistant', message: { id, ...message } };
}

function makeToolLine(id: string, name: unknown): unknown {
  return makeResponse(id, { content: [{ type: 'tool_use', id: 't1', name }] });
}

function makeCallLine(callId: string, name: string): unknown {
  return makeResponse(`m-${ callId }`, { content: [{ type: 'tool_use', id: callId, name }] });
}

function makeAnswerLine(callId: string, fields: Readonly<Record<string, unknown>>): unknown {
  return {
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: callId, ...fields }] },
  };
}

test('counts the turns, tokens, times, models and tools of a transcript', () => {
  const text = toText(
    { type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: { content: 'go' } },
    {
      type: 'assistant',
      timestamp: '2026-01-01T00:00:01.000Z',
      message: {
        id: 'm1',
        model: 'model-a',
        usage: USAGE,
        content: [{ type: 'tool_use', id: 't1', name: 'Read' }],
      },
    },
    {
      type: 'assistant',
      timestamp: '2026-01-01T00:00:12.500Z',
      message: {
        id: 'm2',
        model: 'model-b',
        usage: { input_tokens: 20, output_tokens: 7 },
        content: [{ type: 'text', text: 'done' }],
      },
    },
  );

  assert.deepEqual(getTranscriptUsage(text), {
    turns: 2,
    outputTokens: 12,
    inputTokens: 130,
    cacheReadTokens: 200,
    firstMs: MIDNIGHT_MS,
    lastMs: MIDNIGHT_MS + 12500,
    models: ['model-a', 'model-b'],
    tools: { Read: 1 },
    toolsNotHeld: {},
  });
});

test('counts an API response written on two lines once in turns and tokens', () => {
  const usage = getTranscriptUsage(toText(
    makeResponse('m1', { usage: USAGE }),
    makeResponse('m1', { usage: USAGE }),
  ));

  assert.deepEqual(
    [usage.turns, usage.outputTokens, usage.inputTokens, usage.cacheReadTokens],
    [1, 5, 110, 200],
  );
});

test('counts the tool calls of every line of one response, by name', () => {
  const text = toText(
    makeToolLine('m1', 'Read'),
    makeToolLine('m1', 'Grep'),
    makeToolLine('m2', 'Read'),
  );

  assert.deepEqual(getTranscriptUsage(text).tools, { Read: 2, Grep: 1 });
});

test('counts a call answered with no such tool apart from the call of a tool that ran', () => {
  const usage = getTranscriptUsage(toText(
    makeCallLine('t1', 'Bash'),
    makeAnswerLine('t1', { is_error: true, content: NOT_HELD_ANSWER }),
    makeCallLine('t2', 'Read'),
    makeAnswerLine('t2', { content: 'the text of a file' }),
  ));

  assert.deepEqual([usage.tools, usage.toolsNotHeld], [{ Read: 1 }, { Bash: 1 }]);
});

test('counts a call answered with another error as a tool held', () => {
  const usage = getTranscriptUsage(toText(
    makeCallLine('t1', 'Read'),
    makeAnswerLine('t1', { is_error: true, content: 'File does not exist.' }),
  ));

  assert.deepEqual([usage.tools, usage.toolsNotHeld], [{ Read: 1 }, {}]);
});

test('counts a call whose answer is no error and quotes the words as a tool held', () => {
  const usage = getTranscriptUsage(toText(
    makeCallLine('t1', 'Read'),
    makeAnswerLine('t1', { content: NOT_HELD_ANSWER }),
  ));

  assert.deepEqual([usage.tools, usage.toolsNotHeld], [{ Read: 1 }, {}]);
});

test('counts a call with no answer as a tool held', () => {
  const usage = getTranscriptUsage(toText(makeCallLine('t1', 'Bash')));

  assert.deepEqual([usage.tools, usage.toolsNotHeld], [{ Bash: 1 }, {}]);
});

test('counts no tool call without a name', () => {
  assert.deepEqual(getTranscriptUsage(toText(makeToolLine('m1', 7))).tools, {});
});

test('counts no block that is not a tool call', () => {
  const text = toText(makeResponse('m1', { content: [{ type: 'text', name: 'Read' }] }));

  assert.deepEqual(getTranscriptUsage(text).tools, {});
});

test('reads no response and no tool call from a line that is not an assistant line', () => {
  const text = toText({
    type: 'api-request-blob',
    message: {
      id: 'm1',
      model: 'model-a',
      usage: USAGE,
      content: [{ type: 'tool_use', id: 't1', name: 'Read' }],
    },
  });

  assert.deepEqual(getTranscriptUsage(text), NO_USAGE);
});

test('adds the cache-write tokens to the input tokens', () => {
  const text = toText(makeResponse('m1', {
    usage: { input_tokens: 3, cache_creation_input_tokens: 40 },
  }));

  assert.equal(getTranscriptUsage(text).inputTokens, 43);
});

test('counts a response without usage as a turn of no tokens', () => {
  const usage = getTranscriptUsage(toText(makeResponse('m1', {})));

  assert.deepEqual(
    [usage.turns, usage.outputTokens, usage.inputTokens, usage.cacheReadTokens],
    [1, 0, 0, 0],
  );
});

test('counts a usage field that is not a number as 0', () => {
  const text = toText(makeResponse('m1', { usage: { input_tokens: '9', output_tokens: 4 } }));
  const usage = getTranscriptUsage(text);

  assert.deepEqual([usage.inputTokens, usage.outputTokens], [0, 4]);
});

test('leaves out an assistant message without an id', () => {
  const text = toText({ type: 'assistant', message: { model: 'model-a', usage: USAGE } });

  assert.deepEqual(getTranscriptUsage(text), NO_USAGE);
});

test('names each model once, in the order of its first response', () => {
  const text = toText(
    makeResponse('m1', { model: 'model-b' }),
    makeResponse('m2', { model: 'model-a' }),
    makeResponse('m3', { model: 'model-b' }),
    makeResponse('m4', {}),
  );

  assert.deepEqual(getTranscriptUsage(text).models, ['model-b', 'model-a']);
});

test('gives the earliest and the latest time, whatever the order and the type of a line', () => {
  const usage = getTranscriptUsage(toText(
    { type: 'assistant', timestamp: '2026-01-01T00:00:05.000Z' },
    { type: 'user', timestamp: '2026-01-01T00:00:09.000Z' },
    { type: 'system', timestamp: '2026-01-01T00:00:02.000Z' },
  ));

  assert.deepEqual([usage.firstMs, usage.lastMs], [MIDNIGHT_MS + 2000, MIDNIGHT_MS + 9000]);
});

test('leaves out a time that is not a date and one that is not a text', () => {
  const usage = getTranscriptUsage(toText(
    { type: 'user', timestamp: 'soon' },
    { type: 'user', timestamp: '2026-01-01T00:00:03.000Z' },
    { type: 'user', timestamp: 4 },
  ));

  assert.deepEqual([usage.firstMs, usage.lastMs], [MIDNIGHT_MS + 3000, MIDNIGHT_MS + 3000]);
});

test('skips a line that does not parse', () => {
  const text = toText('{"type":"assist', makeResponse('m1', { usage: USAGE }), 'not json');

  assert.equal(getTranscriptUsage(text).turns, 1);
});

test('gives zeros and no times for an empty text', () => {
  assert.deepEqual(getTranscriptUsage(''), NO_USAGE);
});
