import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { findCall } from './find-call.ts';
import { FIXED_ARGS, SCRIPT_PATH, getFixedAnswer } from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';
import type { AgentCall, WorkflowRun } from './run-workflow.ts';

const STAGE_TABLE_FIRST_LINE = '\nconst STAGES = {\n';
const STAGE_TABLE_LAST_LINE = '\n};\n';
const MODEL_OR_EFFORT = /(['"`])(?:opus|sonnet|haiku|low|medium|high)\1/u;

// How each agent of the run on FIXED_ARGS runs, in the order of the labels:
// its label, then the agent type, the model and the effort its options name,
// with a dash for one they do not name.
const AGENTS_OF_FIXED_RUN = [
  'completeness delegator:reader opus high',
  'gather-repo:Q1 delegator:reader - -',
  'gather-repo:Q2 delegator:reader - -',
  'gather-repo:Q3 delegator:reader - -',
  'gather-web:Q4 delegator:web-researcher - -',
  'scope delegator:reader opus high',
  'synthesize - opus high',
  'verify-repo:Q1.C1 delegator:reader - -',
  'verify-repo:Q1.C2 delegator:reader - -',
  'verify-repo:Q2.C1 delegator:reader - -',
  'verify-web-third:Q4.C2.v3 delegator:web-researcher opus -',
  'verify-web:Q4.C1.v1 delegator:web-researcher - -',
  'verify-web:Q4.C1.v2 delegator:web-researcher - -',
  'verify-web:Q4.C2.v1 delegator:web-researcher - -',
  'verify-web:Q4.C2.v2 delegator:web-researcher - -',
] as const;

const RETURN_RULE =
  '- Return through the structured output alone: it is the one form of return here, in place of any other your rules name.';

// The label of one agent of each stage that runs as a definition, in the run
// on FIXED_ARGS.
const DEFINITION_AGENT_LABELS = [
  'scope',
  'gather-repo:Q1',
  'gather-web:Q4',
  'verify-repo:Q1.C1',
  'verify-web:Q4.C1.v1',
  'verify-web-third:Q4.C2.v3',
  'completeness',
] as const;

// Those of them whose prompt holds the return rule before its last rule; the
// prompt of the web gatherer holds two rules after it.
const RULE_BEFORE_LAST_LABELS = DEFINITION_AGENT_LABELS.filter(
  (label) => label !== 'gather-web:Q4',
);

test('holds the approved meta', async () => {
  const run = await runWorkflow(SCRIPT_PATH, undefined, getFixedAnswer);

  assert.deepEqual(run.meta, {
    name: 'deep-dive',
    description:
      'Gather and verify the context of a task before its plan is written: questions, claims from the repository and the web, each checked against its source, and a research file beside the plan.',
    whenToUse:
      "When the person asks for a deep dive before a plan is written. Pass args as an object: task (the task in the person's words), directory (the plan's directory, .yapus/plans/<YYYY-MM>/<topic>, under the month that already holds the topic or else the current month, UTC), and optionally questions (a list the research must answer), paths (repository paths to start from) and lanes (a list of repository, web or both; both when absent).",
    phases: [
      { title: 'Scope', detail: '3 to 12 questions, each for the repository or the web' },
      { title: 'Gather', detail: 'one agent per question returns claims with their sources' },
      { title: 'Verify', detail: 'each claim checked against the lines or the page it cites' },
      { title: 'Completeness', detail: 'unread areas and unanswered questions' },
      { title: 'Synthesize', detail: 'research_<digest>.md written beside the plan' },
    ],
  });
});

test('holds no import, no pipeline call and no workflow call', () => {
  assert.doesNotMatch(readFileSync(SCRIPT_PATH, 'utf8'), /import|pipeline\(|workflow\(/u);
});

test('names a model and an effort in the stage table', () => {
  assert.match(readStageTable().table, MODEL_OR_EFFORT);
});

test('names no model and no effort after the stage table', () => {
  assert.doesNotMatch(readStageTable().afterTable, MODEL_OR_EFFORT);
});

test('launches every agent with the agent type, model and effort of its stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(run.calls.map(describeAgent).toSorted(), AGENTS_OF_FIXED_RUN);
});

test('denies tools by name to the synthesize agent alone', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  const denyingCalls = run.calls.filter((call) => 'disallowedTools' in call.options);

  assert.deepEqual(denyingCalls.map((call) => call.options.label), ['synthesize']);
});

test('gives every agent that runs as a definition the return rule once', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(
    DEFINITION_AGENT_LABELS.map((label) => listReturnRules(run, label)),
    DEFINITION_AGENT_LABELS.map(() => [RETURN_RULE]),
  );
});

test('puts the return rule on the line before the last rule of a prompt', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(
    RULE_BEFORE_LAST_LABELS.map((label) => findCall(run, label)?.prompt.split('\n').at(-2)),
    RULE_BEFORE_LAST_LABELS.map(() => RETURN_RULE),
  );
});

test('gives the synthesize agent no return rule', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(listReturnRules(run, 'synthesize'), []);
  assert.equal(findCall(run, 'synthesize')?.prompt.includes('\n## Rules\n'), true);
});

// The label of a call, then the agent type, the model and the effort its
// options name, with a dash for one they do not name.
function describeAgent(call: AgentCall): string {
  const { label, agentType = '-', model = '-', effort = '-' } = call.options;

  return [label, agentType, model, effort].map((part) => String(part)).join(' ');
}

// The lines of the prompt of the call under `label` that name the structured
// output.
function listReturnRules(run: WorkflowRun, label: string): string[] {
  return (findCall(run, label)?.prompt ?? '')
    .split('\n')
    .filter((line) => line.includes('structured output'));
}

// The stage table of the script, from its first line through the line that
// closes it, and the text after that line.
function readStageTable(): { readonly table: string; readonly afterTable: string } {
  const scriptText = readFileSync(SCRIPT_PATH, 'utf8');
  const tableStart = scriptText.indexOf(STAGE_TABLE_FIRST_LINE);
  const tableEnd = scriptText.indexOf(STAGE_TABLE_LAST_LINE, tableStart);

  assert.notEqual(tableStart, -1);
  assert.notEqual(tableEnd, -1);

  return {
    table: scriptText.slice(tableStart, tableEnd),
    afterTable: scriptText.slice(tableEnd),
  };
}
