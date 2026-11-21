import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isWorkflowAgent } from '../../../../../hooks/claude/gates/return/is-workflow-agent.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('tells a workflow agent by the field of the meta file beside its transcript', (t) => {
  const meta = '{"agentType":"delegator:reader","spawnDepth":1,"inWorkflowRun":true}';

  assert.equal(isWorkflowAgent(makeTranscriptPath(t, meta)), true);
});

test('reads a meta file without the field as that of no workflow agent', (t) => {
  assert.equal(isWorkflowAgent(makeTranscriptPath(t, '{"agentType":"delegator:reader"}')), false);
});

test('reads a field that is not true as that of no workflow agent', (t) => {
  assert.equal(isWorkflowAgent(makeTranscriptPath(t, '{"inWorkflowRun":"true"}')), false);
});

test('reads a meta file that is not JSON as that of no workflow agent', (t) => {
  assert.equal(isWorkflowAgent(makeTranscriptPath(t, '{"inWorkflowRun":true')), false);
});

test('reads a meta file that holds no JSON object as that of no workflow agent', (t) => {
  assert.equal(isWorkflowAgent(makeTranscriptPath(t, 'null')), false);
});

test('reads a transcript with no meta file as that of no workflow agent', (t) => {
  assert.equal(isWorkflowAgent(join(makeTempDir(t), 'agent-a1.jsonl')), false);
});

// The path of a transcript whose meta file holds the text; the transcript
// itself is not written, as only its name is read.
function makeTranscriptPath(t: TestContext, meta: string): string {
  const directory = makeTempDir(t);

  writeFileSync(join(directory, 'agent-a1.meta.json'), meta);

  return join(directory, 'agent-a1.jsonl');
}
