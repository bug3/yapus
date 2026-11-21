import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRunStats } from '../../../../../hooks/claude/delegator/dive/format-run-stats.ts';
import type { AgentUsage } from '../../../../../hooks/claude/delegator/dive/get-agent-usages.ts';

const HEADER = [
  '| Stage | Agents | Returned | Turns | Output tokens | Input tokens | Cache-read tokens | Median s | Longest s | Models | Tools |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
].join('\n');
// An agent that started and left no transcript.
const IDLE: AgentUsage = {
  stage: 'scope',
  isReturned: false,
  turns: 0,
  outputTokens: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  firstMs: undefined,
  lastMs: undefined,
  models: [],
  tools: {},
};

test('writes the header, one row per stage and the total line', () => {
  const report = formatRunStats([
    {
      stage: 'scope',
      isReturned: true,
      turns: 4,
      outputTokens: 100,
      inputTokens: 2000,
      cacheReadTokens: 30000,
      firstMs: 0,
      lastMs: 12000,
      models: ['model-a'],
      tools: { Glob: 2, Read: 5 },
    },
    {
      stage: 'gather-repo',
      isReturned: true,
      turns: 3,
      outputTokens: 10,
      inputTokens: 200,
      cacheReadTokens: 3000,
      firstMs: 10000,
      lastMs: 20000,
      models: ['model-b'],
      tools: { Read: 2, Grep: 1 },
    },
    {
      stage: 'gather-repo',
      isReturned: false,
      turns: 6,
      outputTokens: 20,
      inputTokens: 300,
      cacheReadTokens: 4000,
      firstMs: 15000,
      lastMs: 45000,
      models: ['model-b'],
      tools: { Read: 4 },
    },
    { ...IDLE, stage: 'gather-repo', isReturned: true },
  ]);

  assert.equal(report, [
    HEADER,
    '| scope | 1 | 1 | 4.0 | 100 | 2000 | 30000 | 12 | 12 | model-a | Glob 2, Read 5 |',
    '| gather-repo | 3 | 2 | 3.0 | 30 | 500 | 7000 | 20 | 30 | model-b | Grep 1, Read 6 |',
    '',
    'Total: 4 agents, 130 output tokens, 2500 input tokens, 37000 cache-read tokens, 45 s from first to last',
    '',
  ].join('\n'));
});

test('writes the header and a total of zeros for a run of no agent', () => {
  assert.equal(formatRunStats([]), [
    HEADER,
    '',
    'Total: 0 agents, 0 output tokens, 0 input tokens, 0 cache-read tokens, 0 s from first to last',
    '',
  ].join('\n'));
});

test('writes a dash for the seconds, the models and the tools of a stage that has none', () => {
  assert.equal(formatRunStats([IDLE]), [
    HEADER,
    '| scope | 1 | 0 | 0.0 | 0 | 0 | 0 | - | - | - | - |',
    '',
    'Total: 1 agents, 0 output tokens, 0 input tokens, 0 cache-read tokens, 0 s from first to last',
    '',
  ].join('\n'));
});

test('keeps the stages in the order of their first agent', () => {
  const report = formatRunStats([
    { ...IDLE, stage: 'scope' },
    { ...IDLE, stage: 'gather-web' },
    { ...IDLE, stage: 'scope' },
    { ...IDLE, stage: 'completeness' },
  ]);

  assert.deepEqual(report.split('\n').slice(2, 5), [
    '| scope | 2 | 0 | 0.0 | 0 | 0 | 0 | - | - | - | - |',
    '| gather-web | 1 | 0 | 0.0 | 0 | 0 | 0 | - | - | - | - |',
    '| completeness | 1 | 0 | 0.0 | 0 | 0 | 0 | - | - | - | - |',
  ]);
});

test('gives the turns of a stage as the mean per agent with one decimal', () => {
  const report = formatRunStats([
    { ...IDLE, turns: 1 },
    { ...IDLE, turns: 2 },
    { ...IDLE, turns: 2 },
  ]);

  assert.equal(report.split('\n')[2], '| scope | 3 | 0 | 1.7 | 0 | 0 | 0 | - | - | - | - |');
});

test('takes the median and the longest seconds from the agents that have times', () => {
  const report = formatRunStats([
    { ...IDLE, firstMs: 1000, lastMs: 61000 },
    IDLE,
    { ...IDLE, firstMs: 1000, lastMs: 3000 },
    { ...IDLE, firstMs: 1000, lastMs: 11000 },
  ]);

  assert.equal(report.split('\n')[2], '| scope | 4 | 0 | 0.0 | 0 | 0 | 0 | 10 | 60 | - | - |');
});

test('rounds the seconds to whole seconds', () => {
  const report = formatRunStats([
    { ...IDLE, firstMs: 0, lastMs: 1400 },
    { ...IDLE, firstMs: 0, lastMs: 1400 },
    { ...IDLE, firstMs: 0, lastMs: 2600 },
  ]);

  assert.deepEqual(report.split('\n').slice(2), [
    '| scope | 3 | 0 | 0.0 | 0 | 0 | 0 | 1 | 3 | - | - |',
    '',
    'Total: 3 agents, 0 output tokens, 0 input tokens, 0 cache-read tokens, 3 s from first to last',
    '',
  ]);
});

test('names each model of a stage once, in the order of the names', () => {
  const report = formatRunStats([
    { ...IDLE, models: ['model-b', 'model-a'] },
    { ...IDLE, models: ['model-a'] },
  ]);

  assert.equal(
    report.split('\n')[2],
    '| scope | 2 | 0 | 0.0 | 0 | 0 | 0 | - | - | model-a, model-b | - |',
  );
});

test('adds up the calls of each tool over a stage, in the order of the names', () => {
  const report = formatRunStats([
    { ...IDLE, tools: { Read: 2, Grep: 1 } },
    { ...IDLE, tools: { Read: 4, Bash: 1 } },
    { ...IDLE, stage: 'synthesize', tools: { Write: 1 } },
  ]);

  assert.deepEqual(report.split('\n').slice(2, 4), [
    '| scope | 2 | 0 | 0.0 | 0 | 0 | 0 | - | - | - | Bash 1, Grep 1, Read 6 |',
    '| synthesize | 1 | 0 | 0.0 | 0 | 0 | 0 | - | - | - | Write 1 |',
  ]);
});

test('counts the seconds of the run from its earliest to its latest time', () => {
  const report = formatRunStats([
    { ...IDLE, firstMs: 5000, lastMs: 9000 },
    { ...IDLE, stage: 'gather-web', firstMs: 1000, lastMs: 31000 },
    { ...IDLE, stage: 'synthesize', firstMs: 2000, lastMs: 3000 },
  ]);

  assert.equal(
    report.split('\n').at(-2),
    'Total: 3 agents, 0 output tokens, 0 input tokens, 0 cache-read tokens, 30 s from first to last',
  );
});
