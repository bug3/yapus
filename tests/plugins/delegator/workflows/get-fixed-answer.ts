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

// What each agent of the run on FIXED_ARGS returns, by its label.
const FIXED_ANSWERS: Readonly<Record<string, unknown>> = {
  scope: {
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
  },
};

// The stand-in for the agents of a deep-dive run on FIXED_ARGS: the answer of
// a call by its label, and JSON null for a label that has none.
export function getFixedAnswer(call: AgentCall): unknown {
  return FIXED_ANSWERS[String(call.options.label)] ?? JSON_NULL;
}
