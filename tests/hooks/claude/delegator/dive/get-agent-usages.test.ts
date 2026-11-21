import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getAgentUsages } from '../../../../../hooks/claude/delegator/dive/get-agent-usages.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

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
};
// One API response on two lines, each with one tool call.
const SCOPE_TRANSCRIPT = toText(
  { type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: { content: 'go' } },
  makeToolLine('2026-01-01T00:00:01.000Z', 'Glob'),
  makeToolLine('2026-01-01T00:00:02.000Z', 'Read'),
  {
    type: 'user',
    timestamp: '2026-01-01T00:00:03.000Z',
    message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] },
  },
);
const GATHER_TRANSCRIPT = toText(
  makeTurn('2026-01-01T00:00:10.000Z', 'm1', 'Read'),
  makeTurn('2026-01-01T00:00:20.000Z', 'm2', 'Read'),
  makeTurn('2026-01-01T00:00:40.000Z', 'm3', 'Grep'),
);

function toText(...lines: readonly unknown[]): string {
  return lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n');
}

function makeToolLine(timestamp: string, tool: string): unknown {
  return {
    type: 'assistant',
    timestamp,
    message: {
      id: 'm1',
      model: 'model-a',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200,
      },
      content: [{ type: 'tool_use', id: 't1', name: tool }],
    },
  };
}

function makeTurn(timestamp: string, id: string, tool: string): unknown {
  return {
    type: 'assistant',
    timestamp,
    message: {
      id,
      model: 'model-b',
      usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3 },
      content: [{ type: 'tool_use', id: 't1', name: tool }],
    },
  };
}

function makeRunDirectory(t: TestContext, ...journal: readonly unknown[]): string {
  const runDirectory = makeTempDir(t);

  writeFileSync(join(runDirectory, 'journal.jsonl'), `${ toText(...journal) }\n`);

  return runDirectory;
}

test('reads the four agents of a run in two stages, in the order of the journal', (t) => {
  const runDirectory = makeRunDirectory(
    t,
    { type: 'launched' },
    { type: 'started', agentId: 'a1', label: 'scope', phase: 'Scope' },
    { type: 'result', agentId: 'a1', result: { questions: [] } },
    { type: 'started', agentId: 'a2', label: 'gather-repo:Q1', phase: 'Gather' },
    '{"type":"started","agentId":"a9","label":"gather-repo:Q9"',
    { type: 'started', agentId: 'a3', label: 'gather-repo:Q2', phase: 'Gather' },
    { type: 'started', agentId: 'a4', label: 'gather-repo:Q3', phase: 'Gather' },
    { type: 'result', agentId: 'a4', result: { claims: [] } },
    { type: 'result', agentId: 'a2', result: { claims: [] } },
  );

  writeFileSync(join(runDirectory, 'agent-a1.jsonl'), SCOPE_TRANSCRIPT);
  writeFileSync(join(runDirectory, 'agent-a2.jsonl'), GATHER_TRANSCRIPT);
  writeFileSync(join(runDirectory, 'agent-a3.jsonl'), GATHER_TRANSCRIPT);

  const gatherUsage = {
    turns: 3,
    outputTokens: 6,
    inputTokens: 3,
    cacheReadTokens: 9,
    firstMs: MIDNIGHT_MS + 10000,
    lastMs: MIDNIGHT_MS + 40000,
    models: ['model-b'],
    tools: { Read: 2, Grep: 1 },
  };

  assert.deepEqual(getAgentUsages(runDirectory), {
    kind: 'usages',
    usages: [
      {
        stage: 'scope',
        isReturned: true,
        turns: 1,
        outputTokens: 5,
        inputTokens: 110,
        cacheReadTokens: 200,
        firstMs: MIDNIGHT_MS,
        lastMs: MIDNIGHT_MS + 3000,
        models: ['model-a'],
        tools: { Glob: 1, Read: 1 },
      },
      { stage: 'gather-repo', isReturned: true, ...gatherUsage },
      { stage: 'gather-repo', isReturned: false, ...gatherUsage },
      { stage: 'gather-repo', isReturned: true, ...NO_USAGE },
    ],
  });
});

test('takes the stage as the text of the label before its first colon', (t) => {
  const runDirectory = makeRunDirectory(
    t,
    { type: 'started', agentId: 'a1', label: 'verify-web:Q1.C2.v1' },
    { type: 'started', agentId: 'a2', label: 'search:tools: a survey' },
    { type: 'started', agentId: 'a3', label: 'scope' },
  );
  const run = getAgentUsages(runDirectory);

  assert.deepEqual(
    run.kind === 'usages' ? run.usages.map((usage) => usage.stage) : run,
    ['verify-web', 'search', 'scope'],
  );
});

test('gives a started row without a label an empty stage', (t) => {
  const runDirectory = makeRunDirectory(t, { type: 'started', agentId: 'a1' });

  assert.deepEqual(getAgentUsages(runDirectory), {
    kind: 'usages',
    usages: [{ stage: '', isReturned: false, ...NO_USAGE }],
  });
});

test('gives one usage for an agent id of two started rows, with the later label', (t) => {
  const runDirectory = makeRunDirectory(
    t,
    { type: 'started', agentId: 'a1', label: 'gather-repo:Q1' },
    { type: 'started', agentId: 'a2', label: 'scope' },
    { type: 'started', agentId: 'a1', label: 'verify-repo:Q1.C1' },
  );

  assert.deepEqual(getAgentUsages(runDirectory), {
    kind: 'usages',
    usages: [
      { stage: 'verify-repo', isReturned: false, ...NO_USAGE },
      { stage: 'scope', isReturned: false, ...NO_USAGE },
    ],
  });
});

test('gives an agent without a result row as not returned', (t) => {
  const runDirectory = makeRunDirectory(
    t,
    { type: 'started', agentId: 'a1', label: 'scope' },
    { type: 'started', agentId: 'a2', label: 'scope' },
    { type: 'result', agentId: 'a2', result: {} },
    { type: 'other', agentId: 'a1' },
  );
  const run = getAgentUsages(runDirectory);

  assert.deepEqual(
    run.kind === 'usages' ? run.usages.map((usage) => usage.isReturned) : run,
    [false, true],
  );
});

test('gives an agent without a transcript zeros and no times', (t) => {
  const runDirectory = makeRunDirectory(
    t,
    { type: 'started', agentId: 'a1', label: 'scope' },
    { type: 'result', agentId: 'a1', result: {} },
  );

  writeFileSync(join(runDirectory, 'agent-a2.jsonl'), GATHER_TRANSCRIPT);

  assert.deepEqual(getAgentUsages(runDirectory), {
    kind: 'usages',
    usages: [{ stage: 'scope', isReturned: true, ...NO_USAGE }],
  });
});

test('skips a journal line that does not parse and a started row without an agent id', (t) => {
  const runDirectory = makeRunDirectory(
    t,
    'not json',
    { type: 'started', label: 'scope' },
    { type: 'started', agentId: 7, label: 'scope' },
    { type: 'started', agentId: 'a1', label: 'synthesize' },
    '',
  );

  assert.deepEqual(getAgentUsages(runDirectory), {
    kind: 'usages',
    usages: [{ stage: 'synthesize', isReturned: false, ...NO_USAGE }],
  });
});

test('returns a failure that names the journal of a directory without one', (t) => {
  const runDirectory = makeTempDir(t);
  const path = join(runDirectory, 'journal.jsonl');

  assert.deepEqual(getAgentUsages(runDirectory), {
    kind: 'failure',
    detail: `cannot read ${ path }: ENOENT: no such file or directory, open '${ path }'`,
  });
});
