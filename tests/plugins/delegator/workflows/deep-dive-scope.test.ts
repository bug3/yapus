import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FIXED_ARGS,
  JSON_NULL,
  MIXED_PATHS,
  SCRIPT_PATH,
  SOURCE_IDS,
  SOURCE_LINES,
  getFixedAnswer,
} from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';
import type { AgentCall } from './run-workflow.ts';

const { task: TASK, directory: DIRECTORY } = FIXED_ARGS;
const SCOPE_ERROR = 'deep-dive: the scope agent returned nothing; run it again';
const NO_QUESTION_ERROR =
  'deep-dive: no question stands in the lanes given; pass other lanes or run it again';
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
  '## Sources',
  ...SOURCE_LINES,
  '',
  '## Rules',
  '- Return 3 to 12 questions by the size of the task: 3 for a change inside one module, 12 for one that crosses the repository.',
  "- Keep every question the person asked, in the person's words.",
  '- Give each question one lane: repository for what the files of this repository answer, web for external facts such as library behavior, vendor documentation or published reports. Use only the lanes listed above.',
  '- For each web question, name in sources up to 4 of the sources listed above that can answer it, the likeliest first, and none when none fits; a repository question names none.',
  '- Bound each question so one workflow agent answers it in one launch: name the module, the behavior or the external subject it covers, and let no two questions overlap.',
  '- For a repository question, name the paths to start from when you know them.',
  '- Return through the structured output alone: it is the one form of return here, in place of any other your rules name.',
  "- Look at the repository's layout before you split; change no file.",
].join('\n');

// The web lane alone, and a scope answer that holds no question of it.
const WEB_LANE_ARGS = { ...FIXED_ARGS, lanes: ['web'] } as const;
const REPOSITORY_LANE_ARGS = { ...FIXED_ARGS, lanes: ['repository'] } as const;
const REPOSITORY_SCOPE = {
  questions: [
    { lane: 'repository', question: 'Where is the gate?' },
    { lane: 'repository', question: 'Who calls the gate?' },
    { lane: 'repository', question: 'Which tests hold the gate?' },
  ],
} as const;

test('gives the scope agent the approved prompt', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.equal(run.calls[0]?.prompt, SCOPE_PROMPT);
});

test('lists no source and asks for none with the repository lane alone', async () => {
  const run = await runWorkflow(SCRIPT_PATH, REPOSITORY_LANE_ARGS, getFixedAnswer);

  const prompt = run.calls[0]?.prompt ?? '';

  assert.match(prompt, /\n## Lanes\nrepository\n\n## Rules\n/u);
  assert.doesNotMatch(prompt, /## Sources|name in sources/u);
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

test('names no path of the args that may lead out of the repository', async () => {
  const args = { task: TASK, directory: DIRECTORY, paths: MIXED_PATHS };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(
    run.calls[0]?.prompt ?? '',
    /\n## Paths to start from\nhooks\/run\.sh\na\.\.b\/x\.ts\n\n## Lanes\n/u,
  );
});

test('writes none for the paths when every path of the args is refused', async () => {
  const args = { task: TASK, directory: DIRECTORY, paths: ['/etc/hosts', '../x.ts'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', /\n## Paths to start from\nnone\n\n## Lanes\n/u);
});

test('refuses a path of the args that starts at a root once it is on one line', async () => {
  const args = { task: TASK, directory: DIRECTORY, paths: ['\n/etc/hosts'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', /\n## Paths to start from\nnone\n\n## Lanes\n/u);
});

test('launches one scope agent with the options of its stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  const scopeCalls = run.calls.filter((call) => call.options.label === 'scope');

  assert.deepEqual(scopeCalls.map((call) => call.options), [
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
                sources: {
                  type: 'array',
                  maxItems: 4,
                  items: { type: 'string', enum: SOURCE_IDS },
                },
              },
              required: ['lane', 'question'],
            },
          },
        },
        required: ['questions'],
      },
      agentType: 'delegator:reader',
      model: 'opus',
      effort: 'high',
    },
  ]);
});

test('enters the Scope phase first', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.equal(run.phases[0], 'Scope');
});

test('logs the questions the scope agent returned, by lane', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.equal(run.logs[0], 'scope: 4 questions (3 repository, 1 web)');
});

test('returns the questions by lane and the scope agent by its stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.partialDeepStrictEqual(run.returned, {
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

test('returns the no-question error and the counts when the lanes leave no question', async () => {
  const run = await runWorkflow(SCRIPT_PATH, WEB_LANE_ARGS, answerRepositoryScope);

  assert.deepEqual(run.returned, {
    error: NO_QUESTION_ERROR,
    stats: {
      questions: { repository: 0, web: 0 },
      followUps: {
        questions: { repository: 0, web: 0 },
        claims: { repository: 0, web: 0 },
        verified: { repository: 0, web: 0 },
      },
      dropped: 3,
      claims: { repository: 0, web: 0 },
      verified: { repository: 0, web: 0 },
      refuted: { repository: 0, web: 0 },
      undecided: { repository: 0, web: 0 },
      notLaunched: 0,
      pathsRefused: 0,
      gatherReturns: { count: 0, longest: 0 },
      stages: Object.fromEntries([
        ['scope', { launched: 1, returned: 1 }],
        ['gather-repo', { launched: 0, returned: 0 }],
        ['gather-web', { launched: 0, returned: 0 }],
        ['verify-repo', { launched: 0, returned: 0 }],
        ['verify-web', { launched: 0, returned: 0 }],
        ['verify-web-third', { launched: 0, returned: 0 }],
        ['completeness', { launched: 0, returned: 0 }],
        ['follow-up-repo', { launched: 0, returned: 0 }],
        ['follow-up-web', { launched: 0, returned: 0 }],
        ['synthesize', { launched: 0, returned: 0 }],
      ]),
    },
  });
});

test('launches no agent after the scope agent when the lanes leave no question', async () => {
  const run = await runWorkflow(SCRIPT_PATH, WEB_LANE_ARGS, answerRepositoryScope);

  assert.deepEqual(run.calls.map((call) => call.options.label), ['scope']);
});

test('enters no phase after Scope when the lanes leave no question', async () => {
  const run = await runWorkflow(SCRIPT_PATH, WEB_LANE_ARGS, answerRepositoryScope);

  assert.deepEqual(run.phases, ['Scope']);
});

test('logs the scope line alone when the lanes leave no question', async () => {
  const run = await runWorkflow(SCRIPT_PATH, WEB_LANE_ARGS, answerRepositoryScope);

  assert.deepEqual(run.logs, ['scope: 0 questions (0 repository, 0 web)']);
});

// The stand-in of the fixed run, but for its scope agent, which returns
// repository questions alone.
function answerRepositoryScope(call: AgentCall): unknown {
  return call.options.label === 'scope' ? REPOSITORY_SCOPE : getFixedAnswer(call);
}
