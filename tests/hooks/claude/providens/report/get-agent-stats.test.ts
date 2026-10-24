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
};

test('counts launches, ends and returns of one agent and takes the medians', () => {
  const stats = getAgentStats([
    LAUNCH,
    { ...LAUNCH, allowed: false, reason: 'r' },
    END,
    { ...END, capped: true, durationMs: 300, tokens: undefined },
    { ...END, status: 'async_launched', durationMs: 9000 },
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
    returns: 3,
    sentBack: 1,
    contractWords: 2,
    verdicts: { REWORK: 2 },
    durationMedianMs: 200,
    tokensMedian: 10,
    toolUsesMedian: 3,
  }]);
});

test('gives one entry per agent, sorted by name, with undefined medians without ends', () => {
  const stats = getAgentStats([{ ...LAUNCH, subject: 'providens:warden' }, LAUNCH]);

  assert.deepEqual(stats.map((entry) => entry.agent), [BUILDER, 'providens:warden']);
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
