export const meta = {
  "name": "deep-dive",
  "description": "Gather and verify the context of a task before its plan is written: questions, claims from the repository and the web, each checked against its source, and a research file beside the plan.",
  "whenToUse": "When the person asks for a deep dive before a plan is written. Pass args as an object: task (the task in the person's words), directory (the plan's directory, .yapus/plans/<YYYY-MM>/<topic>, under the month that already holds the topic or else the current month, UTC), and optionally questions (a list the research must answer), paths (repository paths to start from) and lanes (a list of repository, web or both; both when absent).",
  "phases": [
    { "title": "Scope", "detail": "3 to 12 questions, each for the repository or the web" },
    { "title": "Gather", "detail": "one agent per question returns claims with their sources" },
    { "title": "Verify", "detail": "each claim checked against the lines or the page it cites" },
    { "title": "Completeness", "detail": "unread areas and unanswered questions" },
    { "title": "Synthesize", "detail": "research_<digest>.md written beside the plan" }
  ]
}

// The meta above is JSON, and its last line is the first that is `}` alone:
// the tests take it from the text without running it.

// What the agent of each stage runs as, by stage id. A model and an effort
// are named here and nowhere below.
const STAGES = {
  scope: { phase: 'Scope', model: 'opus', effort: 'high' },
};

// The built-in tools that change files or launch agents, denied to an agent
// that is given no agent type. A name the agent never held raises no error,
// and an agent denied Bash holds Read, Glob and Grep.
const DENIED_TOOLS = ['Bash', 'Edit', 'NotebookEdit', 'PowerShell', 'Agent', 'Write'];

const LANES = ['repository', 'web'];
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 12;

// What the agent of each stage returns, by stage id.
const SCHEMAS = {
  scope: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        minItems: MIN_QUESTIONS,
        maxItems: MAX_QUESTIONS,
        items: {
          type: 'object',
          properties: {
            lane: { type: 'string', enum: LANES },
            question: { type: 'string' },
            startAt: { type: 'array', items: { type: 'string' } },
          },
          required: ['lane', 'question'],
        },
      },
    },
    required: ['questions'],
  },
};

// A plan's directory is PLANS_PREFIX, a month and a topic. A script can load
// no module, so the month and the topic forms of
// hooks/claude/delegator/plans/ stand here a second time.
const PLANS_PREFIX = '.yapus/plans/';
const MONTH_NAME = /^\d{4}-(0[1-9]|1[0-2])$/u;
const TOPIC_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}._-]*$/u;
const MAX_TOPIC_LENGTH = 64;

const ARGS_ERROR =
  'deep-dive: args is not an object with task and directory; pass {task, directory, questions, paths, lanes}';
const SCOPE_ERROR = 'deep-dive: the scope agent returned nothing; run it again';

const NO_LINES = 'none';

// The agents launched and the agents that returned an answer, by stage id.
const stageCounts = Object.fromEntries(
  Object.keys(STAGES).map((stageId) => [stageId, { launched: 0, returned: 0 }]),
);

const input = readInput(args);

if (input.kind === 'failure') {
  return { error: input.detail };
}

phase(STAGES.scope.phase);

const scope = await launchAgent('scope', formatScopePrompt(input));

if (scope === undefined) {
  return { error: SCOPE_ERROR };
}

const questionCounts = countByLane(scope.questions);

log(`scope: ${ scope.questions.length } questions (${ formatLaneCounts(questionCounts) })`);

return { stats: { questions: questionCounts, stages: stageCounts } };

// The run's input from its args, or the failure line that names what they
// lack. A script has no clock and no filesystem, so the session names the
// plan's directory, and the form of that name is what is checked here.
function readInput(runArgs) {
  if (!hasInputShape(runArgs)) {
    return { kind: 'failure', detail: ARGS_ERROR };
  }

  if (!isPlanDirectory(runArgs.directory)) {
    return {
      kind: 'failure',
      detail:
        `deep-dive: directory "${ runArgs.directory }" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan's directory`,
    };
  }

  const namedLanes = runArgs.lanes ?? [];
  const unknownLane = namedLanes.find((lane) => !LANES.includes(lane));

  if (unknownLane !== undefined) {
    return {
      kind: 'failure',
      detail: `deep-dive: lanes holds "${ unknownLane }"; pass repository, web or both`,
    };
  }

  return {
    kind: 'input',
    task: runArgs.task.trim(),
    questions: runArgs.questions ?? [],
    paths: runArgs.paths ?? [],
    // A list that names no lane leaves both, as an absent one does.
    lanes: namedLanes.length === 0 ? LANES : LANES.filter((lane) => namedLanes.includes(lane)),
  };
}

function hasInputShape(runArgs) {
  return typeof runArgs === 'object'
    && runArgs !== null
    && typeof runArgs.task === 'string'
    && runArgs.task.trim() !== ''
    && typeof runArgs.directory === 'string'
    && [runArgs.questions, runArgs.paths, runArgs.lanes].every(isAbsentOrTexts);
}

// A session can write an absent list as JSON null.
function isAbsentOrTexts(texts) {
  return texts === undefined
    || texts === null
    || (Array.isArray(texts) && texts.every((text) => typeof text === 'string'));
}

function isPlanDirectory(directory) {
  if (!directory.startsWith(PLANS_PREFIX)) {
    return false;
  }

  const names = directory.slice(PLANS_PREFIX.length).split('/');
  const [month, topic] = names;

  return names.length === 2
    && MONTH_NAME.test(month)
    && topic.length <= MAX_TOPIC_LENGTH
    && TOPIC_NAME.test(topic);
}

function formatScopePrompt({ task, questions, paths, lanes }) {
  return [
    'Split one task into the questions its plan needs answered before it is written.',
    '',
    '## Task',
    task,
    '',
    '## Questions the person asked',
    formatLines(questions),
    '',
    '## Paths to start from',
    formatLines(paths),
    '',
    '## Lanes',
    lanes.join(', '),
    '',
    '## Rules',
    `- Return ${ MIN_QUESTIONS } to ${ MAX_QUESTIONS } questions by the size of the task: ${ MIN_QUESTIONS } for a change inside one module, ${ MAX_QUESTIONS } for one that crosses the repository.`,
    "- Keep every question the person asked, in the person's words.",
    '- Give each question one lane: repository for what the files of this repository answer, web for external facts such as library behavior, vendor documentation or published reports. Use only the lanes listed above.',
    '- Bound each question so one agent answers it in one launch: name the module, the behavior or the external subject it covers, and let no two questions overlap.',
    '- For a repository question, name the paths to start from when you know them.',
    "- Look at the repository's layout before you split; change no file.",
  ].join('\n');
}

// One entry on each line, so an entry that holds a line break is put on one.
function formatLines(entries) {
  return entries.length === 0 ? NO_LINES : entries.map(toOneLine).join('\n');
}

function toOneLine(text) {
  return text.replace(/\s*[\n\r]\s*/gu, ' ').trim();
}

function countByLane(questions) {
  return Object.fromEntries(
    LANES.map((lane) => [lane, questions.filter((question) => question.lane === lane).length]),
  );
}

function formatLaneCounts(laneCounts) {
  return LANES.map((lane) => `${ laneCounts[lane] } ${ lane }`).join(', ');
}

// Launches the agent of one stage and gives its answer, or undefined for an
// agent that was skipped, died or was rejected; a rejection is logged. Every
// launch of the run goes through here, so the counts hold them all.
async function launchAgent(stageId, prompt) {
  const stage = STAGES[stageId];
  const stageCount = stageCounts[stageId];
  let answer;

  stageCount.launched += 1;

  try {
    answer = await agent(prompt, {
      label: stageId,
      phase: stage.phase,
      schema: SCHEMAS[stageId],
      model: stage.model,
      effort: stage.effort,
      disallowedTools: DENIED_TOOLS,
    });
  } catch (error) {
    log(`${ stageId } failed: ${ getFirstLine(error) }`);

    return undefined;
  }

  // The runtime gives null for an agent that was skipped or died.
  if (answer === null || answer === undefined) {
    return undefined;
  }

  stageCount.returned += 1;

  return answer;
}

// A rejection can come from outside the realm of the script, where it is no
// instance of this realm's Error, so the message is read as a property.
function getFirstLine(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error);

  return message.split('\n')[0];
}
