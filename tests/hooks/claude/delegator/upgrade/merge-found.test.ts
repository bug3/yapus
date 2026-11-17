import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Found,
  mergeFound,
} from '../../../../../hooks/claude/delegator/upgrade/merge-found.ts';

const LOGS: Found = {
  moves: [{ kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' }],
  left: [{ path: 'prompts/s2.jsonl', reason: 'no time' }],
};
const PLANS: Found = {
  moves: [
    { kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' },
    { kind: 'removal', path: 'prompts' },
  ],
  left: [{ path: 'plans/two words.md', reason: 'no topic' }],
};

test('gives the moves and the left files of the parts in the order of the parts', () => {
  assert.deepEqual(mergeFound([LOGS, PLANS]), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' },
      { kind: 'removal', path: 'prompts' },
    ],
    left: [
      { path: 'prompts/s2.jsonl', reason: 'no time' },
      { path: 'plans/two words.md', reason: 'no topic' },
    ],
  });
});
