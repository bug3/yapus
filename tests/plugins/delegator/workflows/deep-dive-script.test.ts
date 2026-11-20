import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SCRIPT_PATH, getFixedAnswer } from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';

const STAGE_TABLE_FIRST_LINE = '\nconst STAGES = {\n';
const STAGE_TABLE_LAST_LINE = '\n};\n';
const MODEL_OR_EFFORT = /(['"`])(?:opus|sonnet|haiku|low|medium|high)\1/u;

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
