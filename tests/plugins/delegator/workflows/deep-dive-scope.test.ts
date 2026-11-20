import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIXED_ARGS, JSON_NULL, SCRIPT_PATH, getFixedAnswer } from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';

const { task: TASK, directory: DIRECTORY } = FIXED_ARGS;
const SCOPE_ERROR = 'deep-dive: the scope agent returned nothing; run it again';
// No source says that what the runtime rejects with is an Error.
const SPAWN_DENIAL: unknown = 'spawn denied';
const SCOPE_PROMPT = [
  'Split one task into the questions its plan needs answered before it is written.',
  '',
  '## Task',
  'Add a retry limit to the return gate',
  '',
  '## Questions the person asked',
  'Where does the return gate count a send-back?',
  'What does Claude Code do when a SubagentStop hook blocks twice?',
  '',
  '## Paths to start from',
  'hooks/claude/gates/return',
  'plugins/delegator/hooks/hooks.json',
  '',
  '## Lanes',
  'repository, web',
  '',
  '## Rules',
  '- Return 3 to 12 questions by the size of the task: 3 for a change inside one module, 12 for one that crosses the repository.',
  "- Keep every question the person asked, in the person's words.",
  '- Give each question one lane: repository for what the files of this repository answer, web for external facts such as library behavior, vendor documentation or published reports. Use only the lanes listed above.',
  '- Bound each question so one agent answers it in one launch: name the module, the behavior or the external subject it covers, and let no two questions overlap.',
  '- For a repository question, name the paths to start from when you know them.',
  "- Look at the repository's layout before you split; change no file.",
].join('\n');

test('gives the scope agent the approved prompt', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.equal(run.calls[0]?.prompt, SCOPE_PROMPT);
});

test('writes none for the questions and the paths the args leave out', async () => {
  const run = await runWorkflow(SCRIPT_PATH, { task: TASK, directory: DIRECTORY }, getFixedAnswer);

  assert.match(
    run.calls[0]?.prompt ?? '',
    /\n## Questions the person asked\nnone\n\n## Paths to start from\nnone\n\n## Lanes\n/u,
  );
});

test('puts a question that holds a line break on one line', async () => {
  const args = {
    task: TASK,
    directory: DIRECTORY,
    questions: ['Where is the gate,\n  and who calls it?'],
  };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(
    run.calls[0]?.prompt ?? '',
    /\n## Questions the person asked\nWhere is the gate, and who calls it\?\n\n## Paths to start from\n/u,
  );
});

test('launches one scope agent with the options of its stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(run.calls.map((call) => call.options), [
    {
      label: 'scope',
      phase: 'Scope',
      schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            minItems: 3,
            maxItems: 12,
            items: {
              type: 'object',
              properties: {
                lane: { type: 'string', enum: ['repository', 'web'] },
                question: { type: 'string' },
                startAt: { type: 'array', items: { type: 'string' } },
              },
              required: ['lane', 'question'],
            },
          },
        },
        required: ['questions'],
      },
      model: 'opus',
      effort: 'high',
      disallowedTools: ['Bash', 'Edit', 'NotebookEdit', 'PowerShell', 'Agent', 'Write'],
    },
  ]);
});

test('enters the Scope phase', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(run.phases, ['Scope']);
});

test('logs the questions the scope agent returned, by lane', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(run.logs, ['scope: 4 questions (3 repository, 1 web)']);
});

test('returns the questions by lane and the agents by stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(run.returned, {
    stats: {
      questions: { repository: 3, web: 1 },
      stages: { scope: { launched: 1, returned: 1 } },
    },
  });
});

test('returns the scope error for a scope agent that returns nothing', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, () => JSON_NULL);

  assert.deepEqual(run.returned, { error: SCOPE_ERROR });
  assert.deepEqual(run.logs, []);
});

test('returns the scope error and logs the failure for a scope agent that rejects', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, () => {
    throw new Error('agent died\nat the second turn');
  });

  assert.deepEqual(run.returned, { error: SCOPE_ERROR });
  assert.deepEqual(run.logs, ['scope failed: agent died']);
});

test('logs a rejection that is no error as its text', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, () => {
    throw SPAWN_DENIAL;
  });

  assert.deepEqual(run.logs, ['scope failed: spawn denied']);
});
