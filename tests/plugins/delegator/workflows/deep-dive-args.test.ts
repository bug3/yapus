import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMonthName } from '../../../../hooks/claude/delegator/plans/is-month-name.ts';
import { isTopicName } from '../../../../hooks/claude/delegator/plans/is-topic-name.ts';
import { FIXED_ARGS, JSON_NULL, SCRIPT_PATH, getFixedAnswer } from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';

const { task: TASK, directory: DIRECTORY } = FIXED_ARGS;
const ARGS_ERROR =
  'deep-dive: args is not an object with task and directory; pass {task, directory, questions, paths, lanes}';
// A topic of 64 units is the longest a plan's directory takes.
const LONGEST_TOPIC = 'a'.repeat(64);
const BOTH_LANES = /\n## Lanes\nrepository, web\n\n## Rules\n/u;

// A month and a topic the plans of the hooks take, to stand beside a sample
// of the other name.
const TAKEN_MONTH = '2026-11';
const TAKEN_TOPIC = 'x';

// Month names on both sides of each point of the hooks' form: the range of
// the month, the count of the digits, the two ends of the name, the digits
// of another script and the separator.
const MONTH_SAMPLES = [
  '2026-01',
  '2026-12',
  '0001-01',
  '2026-00',
  '2026-13',
  '2026-1',
  '26-11',
  '20266-11',
  '2026-11-15',
  'x2026-11',
  '2026-11\n',
  '\u0662\u0660\u0662\u0666-11',
  '2026_11',
  '',
] as const;

// Topic names on both sides of each point of the hooks' form: the first
// character, the characters after it, the letters of another script with a
// combining mark, and the length limit, which counts UTF-16 units, so 32
// letters of two units each fit and 33 do not.
const TOPIC_SAMPLES = [
  'yapus-layout',
  'plan_v2.1-final',
  '2026',
  '\u00e7al\u0131\u015fma',
  's\u0327irket',
  '.',
  '..',
  '.hidden',
  '-topic',
  '_topic',
  '\u0327topic',
  'a plan',
  'line\nbreak',
  'topic\n',
  'a,b',
  'tick`',
  '{path}',
  'a/b',
  '',
  LONGEST_TOPIC,
  `${ LONGEST_TOPIC }a`,
  '\u{1d49c}'.repeat(32),
  '\u{1d49c}'.repeat(33),
] as const;

const NAME_SAMPLES = [
  ...MONTH_SAMPLES.map((month) => ({ month, topic: TAKEN_TOPIC })),
  ...TOPIC_SAMPLES.map((topic) => ({ month: TAKEN_MONTH, topic })),
] as const;

test('returns the args error and launches no agent for a string', async () => {
  const run = await runWorkflow(SCRIPT_PATH, TASK, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the args error and launches no agent for args that are absent', async () => {
  const run = await runWorkflow(SCRIPT_PATH, JSON_NULL, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the args error and launches no agent for an object without task', async () => {
  const run = await runWorkflow(SCRIPT_PATH, { directory: DIRECTORY }, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the args error and launches no agent for a blank task', async () => {
  const args = { task: ' \n', directory: DIRECTORY };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the args error and launches no agent for an object without directory', async () => {
  const run = await runWorkflow(SCRIPT_PATH, { task: TASK }, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the args error and launches no agent for lanes that are no list', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: 'web' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the args error and launches no agent for a question that is no text', async () => {
  const args = { task: TASK, directory: DIRECTORY, questions: [TASK, 7] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, { error: ARGS_ERROR });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for a month of 13', async () => {
  const args = { task: TASK, directory: '.yapus/plans/2026-13/x' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      'deep-dive: directory ".yapus/plans/2026-13/x" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan\'s directory',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for a path that climbs', async () => {
  const args = { task: TASK, directory: '.yapus/plans/2026-11/../x' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      'deep-dive: directory ".yapus/plans/2026-11/../x" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan\'s directory',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for a path outside .yapus', async () => {
  const args = { task: TASK, directory: 'plans/2026-11/x' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      'deep-dive: directory "plans/2026-11/x" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan\'s directory',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for another root', async () => {
  const args = { task: TASK, directory: '.other/plans/2026-11/x' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      'deep-dive: directory ".other/plans/2026-11/x" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan\'s directory',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for a path below a topic', async () => {
  const args = { task: TASK, directory: '.yapus/plans/2026-11/x/notes' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      'deep-dive: directory ".yapus/plans/2026-11/x/notes" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan\'s directory',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for a month with no topic', async () => {
  const args = { task: TASK, directory: '.yapus/plans/2026-11' };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      'deep-dive: directory ".yapus/plans/2026-11" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan\'s directory',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the directory error and launches no agent for a topic of 65 units', async () => {
  const args = { task: TASK, directory: `.yapus/plans/2026-11/${ LONGEST_TOPIC }a` };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error:
      `deep-dive: directory ".yapus/plans/2026-11/${ LONGEST_TOPIC }a" is not .yapus/plans/<YYYY-MM>/<topic>; pass the plan's directory`,
  });
  assert.deepEqual(run.calls, []);
});

test('launches the scope agent for a topic of 64 units', async () => {
  const args = { task: TASK, directory: `.yapus/plans/2026-11/${ LONGEST_TOPIC }` };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.equal(run.calls[0]?.options.label, 'scope');
});

test('takes the month and the topic names the plans of the hooks take, and no other', async () => {
  assert.deepEqual(
    await Promise.all(NAME_SAMPLES.map(({ month, topic }) => takesPlanDirectory(month, topic))),
    NAME_SAMPLES.map(({ month, topic }) => isMonthName(month) && isTopicName(topic)),
  );
});

test('returns the lanes error and launches no agent for a lane that is neither', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['mail'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error: 'deep-dive: lanes holds "mail"; pass ["repository"], ["web"] or ["repository", "web"]',
  });
  assert.deepEqual(run.calls, []);
});

test('returns the lanes error and launches no agent for a lane named both', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['both'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.deepEqual(run.returned, {
    error: 'deep-dive: lanes holds "both"; pass ["repository"], ["web"] or ["repository", "web"]',
  });
  assert.deepEqual(run.calls, []);
});

test('launches the scope agent for the repository lane alone', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['repository'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.equal(run.calls[0]?.options.label, 'scope');
});

test('launches the scope agent for the web lane alone', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['web'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.equal(run.calls[0]?.options.label, 'scope');
});

test('launches the scope agent for the two lanes named together', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['repository', 'web'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.equal(run.calls[0]?.options.label, 'scope');
});

test('launches the scope agent with both lanes for a task and a directory alone', async () => {
  const run = await runWorkflow(SCRIPT_PATH, { task: TASK, directory: DIRECTORY }, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', BOTH_LANES);
  assert.equal(run.calls[0]?.options.label, 'scope');
});

test('names both lanes for lanes that are JSON null', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: JSON_NULL };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', BOTH_LANES);
});

test('names both lanes for a list that names no lane', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: [] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', BOTH_LANES);
});

test('names the one lane the args name', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['web'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', /\n## Lanes\nweb\n\n## Rules\n/u);
});

test('names each lane once, the repository first, whatever the order in the args', async () => {
  const args = { task: TASK, directory: DIRECTORY, lanes: ['web', 'repository', 'web'] };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  assert.match(run.calls[0]?.prompt ?? '', BOTH_LANES);
});

// Whether the script takes `month` and `topic` as the names of a plan's
// directory: a run on a directory it refuses launches no agent.
async function takesPlanDirectory(month: string, topic: string): Promise<boolean> {
  const args = { task: TASK, directory: `.yapus/plans/${ month }/${ topic }` };

  const run = await runWorkflow(SCRIPT_PATH, args, getFixedAnswer);

  return run.calls.length > 0;
}
