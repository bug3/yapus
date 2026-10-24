import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getTranscriptStats,
  readTranscriptStats,
} from '../../../../../hooks/claude/tyler/return/get-transcript-stats.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIRST_USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_creation_input_tokens: 100,
  cache_read_input_tokens: 200,
};
const LAST_USAGE = {
  input_tokens: 20,
  output_tokens: 7,
  cache_creation_input_tokens: 30,
  cache_read_input_tokens: 40,
};

function makeToolLine(timestamp: string, toolId: string): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    message: {
      id: 'm1',
      model: 'model-a',
      usage: FIRST_USAGE,
      content: [{ type: 'tool_use', id: toolId }],
    },
  });
}

const TRANSCRIPT = [
  JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: {} }),
  makeToolLine('2026-01-01T00:00:01.000Z', 't1'),
  makeToolLine('2026-01-01T00:00:01.500Z', 't2'),
  makeToolLine('2026-01-01T00:00:02.000Z', 't3'),
  JSON.stringify({
    type: 'assistant',
    timestamp: '2026-01-01T00:00:12.500Z',
    message: {
      id: 'm2',
      model: 'model-b',
      usage: LAST_USAGE,
      content: [{ type: 'text', text: 'done' }],
    },
  }),
].join('\n');

const TRANSCRIPT_STATS = {
  turns: 2,
  toolUses: 3,
  tokens: 97,
  durationMs: 12500,
  model: 'model-b',
};

test('counts turns, tool uses, last usage, duration and model', () => {
  assert.deepEqual(getTranscriptStats(TRANSCRIPT), TRANSCRIPT_STATS);
});

test('skips malformed lines and returns undefined without an assistant line', () => {
  assert.equal(getTranscriptStats('not json\n[1,2]\n{"type":"user"}'), undefined);
});

test('counts missing cache fields as 0', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: { id: 'm1', usage: { input_tokens: 4, output_tokens: 6 }, content: [] },
  });

  assert.deepEqual(getTranscriptStats(`bad\n${ line }`), {
    turns: 1,
    toolUses: 0,
    tokens: 10,
    durationMs: 0,
    model: undefined,
  });
});

test('skips a timestamp that is not a date', () => {
  const lines = [
    JSON.stringify({ type: 'user', timestamp: 'later', message: {} }),
    makeToolLine('2026-01-01T00:00:01.000Z', 't1'),
    JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:03.000Z', message: {} }),
  ];

  assert.equal(getTranscriptStats(lines.join('\n'))?.durationMs, 2000);
});

test('reads no stats from a missing path, a directory or an undefined path', (t) => {
  const dir = makeTempDir(t);

  assert.equal(readTranscriptStats(join(dir, 'missing.jsonl')), undefined);
  assert.equal(readTranscriptStats(dir), undefined);
  assert.equal(readTranscriptStats(undefined), undefined);
});

test('reads the stats from a transcript file', (t) => {
  const path = join(makeTempDir(t), 'agent.jsonl');

  writeFileSync(path, TRANSCRIPT);

  assert.deepEqual(readTranscriptStats(path), TRANSCRIPT_STATS);
});
