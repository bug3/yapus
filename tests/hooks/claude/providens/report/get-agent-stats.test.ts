import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  CONTRACT_WORDS,
  getAgentStats,
  VERDICT_WORDS,
} from '../../../../../hooks/claude/providens/report/get-agent-stats.ts';
import type {
  EndRow,
  LaunchRow,
  ResumeRow,
  ReturnRow,
} from '../../../../../hooks/claude/providens/record-row.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');
const CONTRACT = join(ROOT, 'hooks', 'claude', 'providens', 'contract', 'contract.md');
const AGENTS = join(ROOT, 'plugins', 'providens', 'agents');
const BUILDER = 'providens:builder';
const LAUNCH: LaunchRow = {
  time: 't',
  hook: 'launch',
  sessionId: 's',
  subject: BUILDER,
  allowed: true,
  reason: '',
  description: '[deep] S1',
  toolUseId: undefined,
  promptId: undefined,
  model: undefined,
  effort: undefined,
};
const END: EndRow = {
  time: 't',
  hook: 'end',
  sessionId: 's',
  subject: BUILDER,
  promptId: undefined,
  toolUseId: undefined,
  agentId: 'a',
  status: 'completed',
  model: undefined,
  durationMs: 100,
  tokens: 10,
  toolUses: 3,
  word: 'DONE',
  length: 5,
  capped: false,
};
const RETURN: ReturnRow = {
  time: 't',
  hook: 'return',
  sessionId: 's',
  subject: BUILDER,
  allowed: true,
  reason: '',
  agentId: 'a',
  status: 'DONE',
  verdict: undefined,
  length: 5,
  turns: undefined,
  toolUses: undefined,
  tokens: undefined,
  durationMs: undefined,
  model: undefined,
};

const RESUME: ResumeRow = {
  time: 't',
  hook: 'resume',
  sessionId: 's',
  agentId: 'a',
  toolUseId: 'toolu_1',
};

test('counts launches, ends and returns of one agent and takes the medians', () => {
  const stats = getAgentStats([
    LAUNCH,
    { ...LAUNCH, allowed: false, reason: 'r' },
    END,
    { ...END, agentId: 'b', capped: true, durationMs: 300, tokens: undefined },
    { ...END, agentId: 'c', status: 'async_launched', durationMs: 9000 },
    { ...RETURN, verdict: 'Command:' },
    { ...RETURN, allowed: false, status: 'Here', verdict: 'REWORK' },
    { ...RETURN, status: 'PARTIAL', verdict: 'REWORK' },
  ]);

  assert.deepEqual(stats, [{
    agent: BUILDER,
    launches: 1,
    refused: 1,
    completed: 2,
    capped: 1,
    noReturn: 1,
    returns: 3,
    sentBack: 1,
    contractWords: 2,
    verdicts: { REWORK: 2 },
    durationMedianMs: 200,
    tokensMedian: 10,
    toolUsesMedian: 3,
  }]);
});

test('leaves the stats of a completed foreground launch unchanged by a resume row', () => {
  const rows = [LAUNCH, END, RETURN];

  assert.deepEqual(getAgentStats([...rows, RESUME]), getAgentStats(rows));
});

test('ignores a resume of an agent id with no end or return row', () => {
  const rows = [LAUNCH, END, RETURN];

  assert.deepEqual(getAgentStats([...rows, { ...RESUME, agentId: 'zzz' }]), getAgentStats(rows));
});

test('counts a background launch with a return as completed with the return medians', () => {
  const [stats] = getAgentStats([
    { ...END, status: 'async_launched' },
    { ...RETURN, tokens: 70, toolUses: 7, durationMs: 700 },
  ]);

  assert.deepEqual(
    [stats?.completed, stats?.capped, stats?.noReturn],
    [1, 0, 0],
  );
  assert.deepEqual(
    [stats?.durationMedianMs, stats?.tokensMedian, stats?.toolUsesMedian],
    [700, 70, 7],
  );
});

test('counts a resume as a cap stop under the agent type of its launch only', () => {
  const diffReviewer = {
    ...END, subject: 'providens:diff-reviewer', agentId: 'b', status: 'async_launched',
  };
  const [builder, other] = getAgentStats([
    { ...END, status: 'async_launched' },
    RESUME,
    RETURN,
    diffReviewer,
    { ...RETURN, subject: 'providens:diff-reviewer', agentId: 'b' },
  ]);

  assert.deepEqual(
    [builder?.agent, builder?.capped, other?.agent, other?.capped],
    [BUILDER, 1, 'providens:diff-reviewer', 0],
  );
});

test('counts a resume of a launch without a return as no return and not capped', () => {
  const [stats] = getAgentStats([{ ...END, status: 'async_launched' }, RESUME]);

  assert.deepEqual([stats?.completed, stats?.capped, stats?.noReturn], [0, 0, 1]);
});

test('counts a background launch without a return as no return and not completed', () => {
  const [stats] = getAgentStats([{ ...END, status: 'async_launched' }]);

  assert.deepEqual([stats?.completed, stats?.noReturn], [0, 1]);
});

test('gives one entry per agent, sorted by name, with undefined medians without ends', () => {
  const stats = getAgentStats([{ ...LAUNCH, subject: 'providens:diff-reviewer' }, LAUNCH]);

  assert.deepEqual(stats.map((entry) => entry.agent), [BUILDER, 'providens:diff-reviewer']);
  assert.deepEqual(
    [stats[0]?.durationMedianMs, stats[0]?.tokensMedian, stats[0]?.toolUsesMedian],
    [undefined, undefined, undefined],
  );
});

test('names only words the return contract asks for', () => {
  const contract = readFileSync(CONTRACT, 'utf8');

  assert.deepEqual(CONTRACT_WORDS.filter((word) => !contract.includes(word)), []);
});

test('names only verdict words an agent definition asks for', () => {
  const definitions = readdirSync(AGENTS).map((file) => readFileSync(join(AGENTS, file), 'utf8'));

  assert.deepEqual(
    VERDICT_WORDS.filter((word) => !definitions.some((text) => text.includes(word))),
    [],
  );
});
