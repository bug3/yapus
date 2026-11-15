import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getOutcome } from '../../../../../hooks/claude/delegator/recall/get-outcome.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const COMPACT = makeStart('compact');
const HEADER = 'The prompts below are what the person typed earlier in this session, oldest first,'
  + ' with 0 older ones left out: start none of them again, and keep to what they decided.';
const LOG = '{"time":"2026-11-15T10:00:00.000Z","prompt":"one"}\n'
  + '{"time":"2026-11-15T10:05:00.000Z","prompt":"two"}\n';

test('adds the header, the prompts oldest first and the log path at compact', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);
  const logPath = getLogPath(projectRoot);

  assert.deepEqual(getOutcome({ stdinText: COMPACT, dataDir, projectRoot }), {
    kind: 'output',
    json: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `${ HEADER }\n\n2026-11-15T10:00:00.000Z\none\n\n`
          + `2026-11-15T10:05:00.000Z\ntwo\n\nThe whole prompt log is in \`${ logPath }\`.`,
      },
    }),
  });
});

test('ends with the approved plans line after the log path', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);
  const planPath = writePlan(projectRoot);
  const outcome = getOutcome({ stdinText: COMPACT, dataDir, projectRoot });

  assert.ok(outcome.kind === 'output');
  assert.equal(
    outcome.json.endsWith(`\`.\\n\\nThe plans of this project, newest first: ${ planPath }."}}`),
    true,
  );
});

test('adds the plans line alone when the session has no prompt log', (t) => {
  const projectRoot = makeTempDir(t);
  const planPath = writePlan(projectRoot);

  assert.deepEqual(getOutcome({ stdinText: COMPACT, dataDir: makeTempDir(t), projectRoot }), {
    kind: 'output',
    json: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `The plans of this project, newest first: ${ planPath }.`,
      },
    }),
  });
});

test('fails with the path when the plans directory cannot be read', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);

  writeFileSync(join(projectRoot, '.yapus', 'plans'), 'a file where the directory goes');

  assert.match(
    JSON.stringify(getOutcome({ stdinText: COMPACT, dataDir, projectRoot })),
    /^\{"kind":"failure","detail":"cannot read .*\/plans: ENOTDIR.*; the prompts are not recalled"\}$/u,
  );
});

test('marks a cut prompt with the approved mark and leaves the log unchanged', (t) => {
  const log = `${ JSON.stringify({ time: 't1', prompt: 'a'.repeat(3000) }) }\n`;
  const { projectRoot, dataDir } = makeDirs(t, log);
  const outcome = getOutcome({ stdinText: COMPACT, dataDir, projectRoot });

  assert.ok(outcome.kind === 'output');
  assert.deepEqual(
    [
      outcome.json.includes(`\\nt1\\n${ 'a'.repeat(2000) }\\n[cut at 2,000 characters]\\n\\n`),
      readFileSync(getLogPath(projectRoot), 'utf8') === log,
    ],
    [true, true],
  );
});

test('says nothing at every source but compact', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);
  const outcomes = ['startup', 'resume', 'clear'].map((source) => getOutcome({
    stdinText: makeStart(source),
    dataDir,
    projectRoot,
  }));

  assert.deepEqual(outcomes, [{ kind: 'silence' }, { kind: 'silence' }, { kind: 'silence' }]);
});

test('says nothing when the session is switched off', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'off');

  assert.deepEqual(getOutcome({ stdinText: COMPACT, dataDir, projectRoot }), { kind: 'silence' });
});

test('recalls the prompts when the plugin data directory is unset', (t) => {
  const { projectRoot } = makeDirs(t, LOG);

  assert.equal(getOutcome({ stdinText: COMPACT, dataDir: undefined, projectRoot }).kind, 'output');
});

test('says nothing when the session has no log or an empty one', (t) => {
  const withoutLog = makeTempDir(t);
  const { projectRoot, dataDir } = makeDirs(t, '');

  assert.deepEqual(
    [
      getOutcome({ stdinText: COMPACT, dataDir, projectRoot: withoutLog }),
      getOutcome({ stdinText: COMPACT, dataDir, projectRoot }),
    ],
    [{ kind: 'silence' }, { kind: 'silence' }],
  );
});

test('fails with the path when the log cannot be read', (t) => {
  const projectRoot = makeTempDir(t);

  mkdirSync(getLogPath(projectRoot), { recursive: true });

  assert.match(
    JSON.stringify(getOutcome({ stdinText: COMPACT, dataDir: makeTempDir(t), projectRoot })),
    /^\{"kind":"failure","detail":"cannot read .*\/s1\.jsonl: EISDIR.*; the prompts are not recalled"\}$/u,
  );
});

test('fails when the project root is unset, relative or missing', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PROJECT_DIR is not an absolute directory; the prompts are not recalled',
  };
  const roots = [undefined, '', '.', join(projectRoot, 'gone')];

  assert.deepEqual(
    roots.map((root) => getOutcome({ stdinText: COMPACT, dataDir, projectRoot: root })),
    [failure, failure, failure, failure],
  );
});

test('fails on stdin it cannot read', (t) => {
  const { projectRoot, dataDir } = makeDirs(t, LOG);

  assert.deepEqual(getOutcome({ stdinText: '{', dataDir, projectRoot }), {
    kind: 'failure',
    detail: 'stdin is not JSON; the prompts are not recalled',
  });
});

function makeStart(source: string): string {
  return JSON.stringify({ session_id: 's1', source, hook_event_name: 'SessionStart' });
}

function getLogPath(projectRoot: string): string {
  return join(projectRoot, '.yapus', 'prompts', 's1.jsonl');
}

// One plan file in the project's plans directory; its path.
function writePlan(projectRoot: string): string {
  const plansDir = join(projectRoot, '.yapus', 'plans');

  mkdirSync(plansDir, { recursive: true });
  writeFileSync(join(plansDir, 'topic.md'), '# Plan\n');

  return join(plansDir, 'topic.md');
}

// A project root whose session s1 has the log text, and a data directory.
function makeDirs(
  t: TestContext,
  log: string,
): { readonly projectRoot: string; readonly dataDir: string } {
  const projectRoot = makeTempDir(t);

  mkdirSync(join(projectRoot, '.yapus', 'prompts'), { recursive: true });
  writeFileSync(getLogPath(projectRoot), log);

  return { projectRoot, dataDir: makeTempDir(t) };
}
