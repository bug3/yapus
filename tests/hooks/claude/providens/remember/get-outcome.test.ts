import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getOutcome } from '../../../../../hooks/claude/providens/remember/get-outcome.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const TIME = '2026-11-15T10:00:00.000Z';
const PROMPT = makePrompt('go');

test('appends the typed prompt as one line with its time, newlines kept', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);

  getOutcome({ stdinText: makePrompt('one'), dataDir, projectRoot, time: TIME });

  const stdinText = makePrompt('two\nlines');

  assert.deepEqual(getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), {
    kind: 'written',
  });
  assert.equal(
    readFileSync(join(projectRoot, '.yapus', 'prompts', 's1.jsonl'), 'utf8'),
    '{"time":"2026-11-15T10:00:00.000Z","prompt":"one"}\n'
      + '{"time":"2026-11-15T10:00:00.000Z","prompt":"two\\nlines"}\n',
  );
});

test('skips a prompt that opens with a task notification', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const stdinText = makePrompt('<task-notification>done</task-notification>');

  assert.deepEqual(getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), {
    kind: 'silence',
  });
  assert.equal(existsSync(join(projectRoot, '.yapus')), false);
});

test('writes nothing and says nothing when the session is switched off', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'off');

  assert.deepEqual(getOutcome({ stdinText: PROMPT, dataDir, projectRoot, time: TIME }), {
    kind: 'silence',
  });
  assert.equal(existsSync(join(projectRoot, '.yapus')), false);
});

test('fails without writing when no project root is set', (t) => {
  const { dataDir } = makeDirs(t);
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PROJECT_DIR is not an absolute directory; the prompt is not remembered',
  };

  assert.deepEqual(
    [
      getOutcome({ stdinText: PROMPT, dataDir, projectRoot: undefined, time: TIME }),
      getOutcome({ stdinText: PROMPT, dataDir, projectRoot: '', time: TIME }),
    ],
    [failure, failure],
  );
});

test('fails without creating a root that is relative or missing', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const missingRoot = join(projectRoot, 'gone');
  const outcomes = [
    getOutcome({ stdinText: PROMPT, dataDir, projectRoot: 'app', time: TIME }).kind,
    getOutcome({ stdinText: PROMPT, dataDir, projectRoot: missingRoot, time: TIME }).kind,
  ];

  assert.deepEqual([outcomes, existsSync(missingRoot)], [['failure', 'failure'], false]);
});

test('fails when the plugin data directory is unset or empty', (t) => {
  const { projectRoot } = makeDirs(t);
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PLUGIN_DATA is not set; the prompt is not remembered; reinstall the plugin',
  };

  assert.deepEqual(
    [
      getOutcome({ stdinText: PROMPT, dataDir: undefined, projectRoot, time: TIME }),
      getOutcome({ stdinText: PROMPT, dataDir: '', projectRoot, time: TIME }),
    ],
    [failure, failure],
  );
  assert.equal(existsSync(join(projectRoot, '.yapus')), false);
});

test('fails with the path when the prompt log cannot be written', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);

  writeFileSync(join(projectRoot, '.yapus'), 'a file where the directory goes');

  const outcome = getOutcome({ stdinText: PROMPT, dataDir, projectRoot, time: TIME });

  assert.match(
    JSON.stringify(outcome),
    /^\{"kind":"failure","detail":"cannot write .*\/\.yapus\/prompts\/s1\.jsonl: .*; the prompt is not remembered"\}$/u,
  );
});

function makePrompt(prompt: string): string {
  return JSON.stringify({ session_id: 's1', prompt, hook_event_name: 'UserPromptSubmit' });
}

function makeDirs(t: TestContext): { readonly projectRoot: string; readonly dataDir: string } {
  return { projectRoot: makeTempDir(t), dataDir: makeTempDir(t) };
}
