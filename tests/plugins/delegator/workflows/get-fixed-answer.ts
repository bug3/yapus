import { join } from 'node:path';
import type { AgentCall } from './run-workflow.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

export const SCRIPT_PATH = join(ROOT, 'plugins', 'delegator', 'workflows', 'deep-dive.js');

// What the runtime gives a script for an agent that was skipped or died; the
// lint refuses the literal.
export const JSON_NULL: unknown = JSON.parse('null');

// The input of the run whose prompts and lines the tests write out whole.
export const FIXED_ARGS = {
  task: 'Add a retry limit to the return gate',
  directory: '.yapus/plans/2026-11/return-retry',
  questions: [
    'Where does the return gate count a send-back?',
    'What does Claude Code do when a SubagentStop hook blocks twice?',
  ],
  paths: ['hooks/claude/gates/return', 'plugins/delegator/hooks/hooks.json'],
} as const;

// What each agent of the run on FIXED_ARGS returns, by its label. The
// gatherer of the third question has no answer; the claims come out as one
// verified, one refuted and one undecided for the repository, and for the
// web one verified by two votes and one by the third; the file is written.
const FIXED_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['scope', {
    questions: [
      {
        lane: 'repository',
        question: 'Where does the return gate count a send-back?',
        startAt: ['hooks/claude/gates/return'],
      },
      {
        lane: 'repository',
        question: 'Which hook entries run the return gate?',
        startAt: ['plugins/delegator/hooks/hooks.json'],
      },
      { lane: 'repository', question: 'Which tests hold the verdicts of the return gate?' },
      {
        lane: 'web',
        question: 'What does Claude Code do when a SubagentStop hook blocks twice?',
      },
    ],
  }],
  ['gather-repo:Q1', {
    claims: [
      {
        claim: 'The return gate sends a return over the limit back once.',
        path: 'hooks/claude/gates/return/get-return-verdict.ts',
        line: 31,
        excerpt: 'const isOver = length > RETURN_CAP_CHARACTERS;',
      },
      {
        claim: 'The return gate keeps a count of send-backs for each session.',
        path: 'hooks/claude/gates/return/main.ts',
        line: 12,
        excerpt: 'const sendBacks = countSendBacks(session);',
      },
    ],
    notSearched: ['hooks/claude/delegator/status'],
  }],
  ['gather-repo:Q2', {
    claims: [
      {
        claim: 'The SubagentStop entry runs the return gate for the delegator agents.',
        path: 'plugins/delegator/hooks/hooks.json',
        line: 412,
        excerpt: '"matcher": "^delegator:"',
      },
    ],
    notSearched: [],
  }],
  ['gather-web:Q4', {
    claims: [
      {
        claim: 'A SubagentStop hook that exits with code 2 keeps the subagent running.',
        url: 'https://code.claude.com/docs/en/hooks',
        quote: 'Exit code 2 blocks the stop and shows stderr to the subagent',
      },
      {
        claim: 'Claude Code stops a subagent that a hook blocks twice in a row.',
        url: 'https://code.claude.com/docs/en/sub-agents',
        quote: 'a subagent whose stop is blocked twice is stopped',
      },
    ],
    notChecked: ['The changelog: no entry on a repeated block was looked for'],
  }],
  ['verify-repo:Q1.C1', {
    verdict: 'supported',
    evidence: 'get-return-verdict.ts:31 holds the excerpt, and :50 sends back once.',
  }],
  ['verify-repo:Q1.C2', {
    verdict: 'unsupported',
    evidence: 'main.ts:12 reads the payload; the file holds no count of send-backs.',
  }],
  ['verify-repo:Q2.C1', {
    verdict: 'unopened',
    evidence: 'hooks.json has 126 lines.',
  }],
  ['verify-web:Q4.C1.v1', {
    verdict: 'supported',
    evidence: 'The page says: Exit code 2 blocks the stop and shows stderr to the subagent',
  }],
  ['verify-web:Q4.C1.v2', {
    verdict: 'supported',
    evidence: 'The quote stands in the section on exit codes.',
  }],
  ['verify-web:Q4.C2.v1', {
    verdict: 'supported',
    evidence: 'The page holds the quote under Hooks.',
  }],
  ['verify-web:Q4.C2.v2', {
    verdict: 'unsupported',
    evidence: 'The page names no second block.',
  }],
  ['verify-web-third:Q4.C2.v3', {
    verdict: 'supported',
    evidence: 'The quote stands in the last paragraph of the page.',
  }],
  ['completeness', {
    unreadAreas: ['tests/hooks/claude/gates/return'],
    unansweredQuestions: ['Which tests hold the verdicts of the return gate?'],
  }],
  ['synthesize', { outcome: 'written', detail: '' }],
]);

// The stand-in for the agents of a deep-dive run on FIXED_ARGS: the answer of
// a call by its label, and JSON null for a label that has none.
export function getFixedAnswer(call: AgentCall): unknown {
  return FIXED_ANSWERS.get(String(call.options.label)) ?? JSON_NULL;
}
