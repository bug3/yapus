import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIXED_ARGS, JSON_NULL, SCRIPT_PATH, getFixedAnswer } from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';

const { task: TASK, directory: DIRECTORY } = FIXED_ARGS;
const ARGS_ERROR =
  'deep-dive: args is not an object with task and directory; pass {task, directory, questions, paths, lanes}';
// A topic of 64 units is the longest a plan's directory takes.
const LONGEST_TOPIC = 'a'.repeat(64);
const BOTH_LANES = /\n## Lanes\nrepository, web\n\n## Rules\n/u;

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
