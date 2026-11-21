import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getOutcome } from '../../../../../hooks/claude/delegator/link/get-outcome.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const TIME = '2026-11-20T08:00:00.000Z';
const PROMPT_LINE = '{"time":"2026-11-15T10:00:00.000Z","prompt":"go"}\n';
const S1_LINE = '{"time":"2026-11-20T08:00:00.000Z","plan":"2026-11/topic","file":"S1.md"}\n';
const PLAN_LINE = '{"time":"2026-11-20T08:00:00.000Z","plan":"2026-11/topic","file":"plan.md"}\n';
const OTHER_LINE = '{"time":"2026-11-20T08:00:00.000Z","plan":"2026-12/other","file":"S1.md"}\n';

test('appends a plan line for a Write of a file in a plan directory', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  assert.deepEqual(
    [getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), readFileSync(logPath, 'utf8')],
    [{ kind: 'written' }, PROMPT_LINE + S1_LINE],
  );
});

test('appends a plan line for an Edit of a file in a plan directory', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeEdit(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  assert.deepEqual(
    [getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), readFileSync(logPath, 'utf8')],
    [{ kind: 'written' }, PROMPT_LINE + S1_LINE],
  );
});

// A subagent's call carries the session's id beside its own.
test('appends the plan line of a subagent to the file of the session', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = JSON.stringify({
    session_id: 's1',
    agent_id: 'a1120433d1e64e2cd',
    agent_type: 'delegator:finisher',
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: getPlansPath(projectRoot, '2026-11/topic/S1.md'), content: 'a' },
  });

  assert.deepEqual(
    [getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), readFileSync(logPath, 'utf8')],
    [{ kind: 'written' }, PROMPT_LINE + S1_LINE],
  );
});

test('names a file in a directory of the plan by its path below the plan', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/reviews/r1.md'));

  getOutcome({ stdinText, dataDir, projectRoot, time: TIME });

  assert.equal(
    readFileSync(logPath, 'utf8'),
    `${ PROMPT_LINE }{"time":"${ TIME }","plan":"2026-11/topic","file":"reviews/r1.md"}\n`,
  );
});

test('appends nothing for a second write of the same file', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const filePath = getPlansPath(projectRoot, '2026-11/topic/S1.md');

  getOutcome({ stdinText: makeWrite(filePath), dataDir, projectRoot, time: TIME });

  const outcome = getOutcome({ stdinText: makeEdit(filePath), dataDir, projectRoot, time: TIME });

  assert.deepEqual(
    [outcome, readFileSync(logPath, 'utf8')],
    [{ kind: 'silence' }, PROMPT_LINE + S1_LINE],
  );
});

test('appends nothing for the same file after a prompt in between', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  getOutcome({ stdinText, dataDir, projectRoot, time: TIME });
  appendFileSync(logPath, PROMPT_LINE);
  getOutcome({ stdinText, dataDir, projectRoot, time: TIME });

  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE + S1_LINE + PROMPT_LINE);
});

test('appends a line for another file of the plan and for the first file again', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const slice = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));
  const plan = makeWrite(getPlansPath(projectRoot, '2026-11/topic/plan.md'));

  getOutcome({ stdinText: slice, dataDir, projectRoot, time: TIME });
  getOutcome({ stdinText: plan, dataDir, projectRoot, time: TIME });
  getOutcome({ stdinText: slice, dataDir, projectRoot, time: TIME });

  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE + S1_LINE + PLAN_LINE + S1_LINE);
});

test('appends a line for a file of the same name in another plan', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const first = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));
  const second = makeWrite(getPlansPath(projectRoot, '2026-12/other/S1.md'));

  getOutcome({ stdinText: first, dataDir, projectRoot, time: TIME });
  getOutcome({ stdinText: second, dataDir, projectRoot, time: TIME });

  assert.equal(readFileSync(logPath, 'utf8'), PROMPT_LINE + S1_LINE + OTHER_LINE);
});

test('appends nothing for a plan file under another root', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const otherRoot = makeWrite(getPlansPath(makeTempDir(t), '2026-11/topic/S1.md'));
  const nestedRoot = makeWrite(getPlansPath(join(projectRoot, 'app'), '2026-11/topic/S1.md'));

  assert.deepEqual(
    [
      getOutcome({ stdinText: otherRoot, dataDir, projectRoot, time: TIME }),
      getOutcome({ stdinText: nestedRoot, dataDir, projectRoot, time: TIME }),
      readFileSync(logPath, 'utf8'),
    ],
    [{ kind: 'silence' }, { kind: 'silence' }, PROMPT_LINE],
  );
});

test('appends nothing for a plan or a detail file of the older layout', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const plan = makeWrite(getPlansPath(projectRoot, 'topic.md'));
  const detail = makeWrite(getPlansPath(projectRoot, 'topic/S1.md'));

  assert.deepEqual(
    [
      getOutcome({ stdinText: plan, dataDir, projectRoot, time: TIME }),
      getOutcome({ stdinText: detail, dataDir, projectRoot, time: TIME }),
      readFileSync(logPath, 'utf8'),
    ],
    [{ kind: 'silence' }, { kind: 'silence' }, PROMPT_LINE],
  );
});

test('appends nothing for a file directly in a month directory', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/plan.md'));

  assert.deepEqual(
    [getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), readFileSync(logPath, 'utf8')],
    [{ kind: 'silence' }, PROMPT_LINE],
  );
});

test('appends nothing under a month that is none or a topic that is no plain name', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const month = makeWrite(getPlansPath(projectRoot, '2026-13/topic/S1.md'));
  const hidden = makeWrite(getPlansPath(projectRoot, '2026-11/.hidden/S1.md'));
  const spaced = makeWrite(getPlansPath(projectRoot, '2026-11/two words/S1.md'));

  assert.deepEqual(
    [
      getOutcome({ stdinText: month, dataDir, projectRoot, time: TIME }),
      getOutcome({ stdinText: hidden, dataDir, projectRoot, time: TIME }),
      getOutcome({ stdinText: spaced, dataDir, projectRoot, time: TIME }),
      readFileSync(logPath, 'utf8'),
    ],
    [{ kind: 'silence' }, { kind: 'silence' }, { kind: 'silence' }, PROMPT_LINE],
  );
});

test('appends nothing for a file outside the plans directory', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const source = makeWrite(join(projectRoot, 'src', '2026-11', 'topic', 'S1.md'));
  const beside = makeWrite(join(projectRoot, '.yapus', 'plans-old', '2026-11', 'topic', 'S1.md'));

  assert.deepEqual(
    [
      getOutcome({ stdinText: source, dataDir, projectRoot, time: TIME }),
      getOutcome({ stdinText: beside, dataDir, projectRoot, time: TIME }),
      readFileSync(logPath, 'utf8'),
    ],
    [{ kind: 'silence' }, { kind: 'silence' }, PROMPT_LINE],
  );
});

test('creates nothing for a session without a file', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  assert.deepEqual(getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), {
    kind: 'silence',
  });
  assert.equal(existsSync(join(projectRoot, '.yapus')), false);
});

test('leaves the file of another session as it is', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = JSON.stringify({
    session_id: 's2',
    tool_name: 'Write',
    tool_input: { file_path: getPlansPath(projectRoot, '2026-11/topic/S1.md'), content: 'a' },
  });

  assert.deepEqual(
    [getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), readFileSync(logPath, 'utf8')],
    [{ kind: 'silence' }, PROMPT_LINE],
  );
});

test('appends nothing and says nothing when the session is switched off', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'off');

  assert.deepEqual(
    [getOutcome({ stdinText, dataDir, projectRoot, time: TIME }), readFileSync(logPath, 'utf8')],
    [{ kind: 'silence' }, PROMPT_LINE],
  );
});

test('fails without a line when the plugin data directory is unset or empty', (t) => {
  const { projectRoot } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PLUGIN_DATA is not set; the plan line is not written; reinstall the plugin',
  };

  assert.deepEqual(
    [
      getOutcome({ stdinText, dataDir: undefined, projectRoot, time: TIME }),
      getOutcome({ stdinText, dataDir: '', projectRoot, time: TIME }),
      readFileSync(logPath, 'utf8'),
    ],
    [failure, failure, PROMPT_LINE],
  );
});

test('fails on stdin it cannot read', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);

  assert.deepEqual(getOutcome({ stdinText: '{', dataDir, projectRoot, time: TIME }), {
    kind: 'failure',
    detail: 'stdin is not JSON; the plan line is not written',
  });
});

test('fails without a line when the project root is unset or relative', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const logPath = writeLog(projectRoot);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PROJECT_DIR is not an absolute path; the plan line is not written',
  };

  assert.deepEqual(
    [
      getOutcome({ stdinText, dataDir, projectRoot: undefined, time: TIME }),
      getOutcome({ stdinText, dataDir, projectRoot: '.', time: TIME }),
      readFileSync(logPath, 'utf8'),
    ],
    [failure, failure, PROMPT_LINE],
  );
});

test('fails with the path when the sessions directory cannot be read', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  mkdirSync(join(projectRoot, '.yapus'));
  writeFileSync(join(projectRoot, '.yapus', 'sessions'), 'a file where the directory goes');

  assert.match(
    JSON.stringify(getOutcome({ stdinText, dataDir, projectRoot, time: TIME })),
    /^\{"kind":"failure","detail":"cannot read .*\/\.yapus\/sessions: ENOTDIR.*; the plan line is not written"\}$/u,
  );
});

test('fails with the path when the session file cannot be written', (t) => {
  const { projectRoot, dataDir } = makeDirs(t);
  const stdinText = makeWrite(getPlansPath(projectRoot, '2026-11/topic/S1.md'));

  mkdirSync(getLogPath(projectRoot), { recursive: true });

  assert.match(
    JSON.stringify(getOutcome({ stdinText, dataDir, projectRoot, time: TIME })),
    /^\{"kind":"failure","detail":"cannot write .*\/sessions\/2026-11\/15T10-00-00Z_s1\.jsonl: EISDIR.*; the plan line is not written"\}$/u,
  );
});

// The file the session's first logged prompt created, with that prompt.
function writeLog(projectRoot: string): string {
  const logPath = getLogPath(projectRoot);

  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, PROMPT_LINE);

  return logPath;
}

function getLogPath(projectRoot: string): string {
  return join(projectRoot, '.yapus', 'sessions', '2026-11', '15T10-00-00Z_s1.jsonl');
}

function getPlansPath(projectRoot: string, below: string): string {
  return join(projectRoot, '.yapus', 'plans', below);
}

// The payloads as PostToolUse gives them for the two tools.
function makeWrite(filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'a' },
    tool_response: { type: 'create', filePath, content: 'a' },
  });
}

function makeEdit(filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'a', new_string: 'b', replace_all: false },
    tool_response: { filePath, oldString: 'a', newString: 'b', replaceAll: false },
  });
}

function makeDirs(t: TestContext): { readonly projectRoot: string; readonly dataDir: string } {
  return { projectRoot: makeTempDir(t), dataDir: makeTempDir(t) };
}
