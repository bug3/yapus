import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RECORD_FILE } from '../../../../../hooks/claude/delegator/record-row.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'status', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const LAUNCH = {
  time: '2026-11-17T22:00:00Z',
  hook: 'launch',
  sessionId: 's1',
  subject: 'delegator:finisher',
  allowed: true,
  reason: '',
  description: '[deep] S2 x',
  toolUseId: 'toolu_1',
};
const BACKGROUND_END = {
  time: '2026-11-17T22:00:01Z',
  hook: 'end',
  sessionId: 's1',
  subject: 'delegator:finisher',
  toolUseId: 'toolu_1',
  agentId: 'a1',
  status: 'async_launched',
  capped: false,
};
// A transcript line with a tool call that no line answers.
const BASH_CALL = {
  type: 'assistant',
  timestamp: '2026-11-17T22:48:35.209Z',
  message: { content: [{ type: 'tool_use', id: 'call_1', name: 'Bash', input: {} }] },
};

test('prints the defaults and no launches for an empty data dir', (t) => {
  const run = runStatus([makeTempDir(t), 's1'], makeTempDir(t));

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(
    run.stdout,
    'mode: on (default)\nlaunch limit: 60 (default)\nlaunches this session: 0\n',
  );
});

test('prints the global mode and limit with the source global', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'mode'), 'off');
  writeFileSync(join(dataDir, 'launch-limit'), '7');

  assert.equal(
    runStatus([dataDir, 's1'], makeTempDir(t)).stdout,
    'mode: off (global)\nlaunch limit: 7 (global)\nlaunches this session: 0\n',
  );
});

test('prints the session mode and limit over the global ones', (t) => {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'mode'), 'off');
  writeFileSync(join(dataDir, 'launch-limit'), '7');
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'on');
  writeFileSync(join(dataDir, 'sessions', 's1.launch-limit'), '9');

  assert.equal(
    runStatus([dataDir, 's1'], makeTempDir(t)).stdout,
    'mode: on (session)\nlaunch limit: 9 (session)\nlaunches this session: 0\n',
  );
});

test('names the file of an invalid mode and keeps going', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'mode'), 'maybe');

  const run = runStatus([dataDir, 's1'], makeTempDir(t));

  assert.equal(run.status, 0);
  assert.equal(
    run.stdout,
    `mode: ${ join(dataDir, 'mode') } holds no mode\nlaunch limit: 60 (default)\n`
      + 'launches this session: 0\n',
  );
});

test('names the file of an invalid limit and keeps going', (t) => {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'sessions', 's1.launch-limit'), 'many');

  const run = runStatus([dataDir, 's1'], makeTempDir(t));

  assert.equal(run.status, 0);
  assert.equal(
    run.stdout,
    `mode: on (default)\nlaunch limit: ${ join(dataDir, 'sessions', 's1.launch-limit') } `
      + 'holds no whole number\nlaunches this session: 0\n',
  );
});

test('counts the launches of this session only', (t) => {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'launches'));
  writeFileSync(join(dataDir, 'launches', 's1.log'), '+\n+\n+\n');
  writeFileSync(join(dataDir, 'launches', 's2.log'), '+\n');

  assert.match(runStatus([dataDir, 's1'], makeTempDir(t)).stdout, /\nlaunches this session: 3\n$/u);
  assert.match(runStatus([dataDir, 's2'], makeTempDir(t)).stdout, /\nlaunches this session: 1\n$/u);
});

test('prints the call a background subagent waits on after the three lines', (t) => {
  const dataDir = makeTempDir(t);
  const outputFile = join(makeTempDir(t), 'a1.output');

  writeFileSync(outputFile, `${ JSON.stringify(BASH_CALL) }\n`);
  writeFileSync(
    join(dataDir, RECORD_FILE),
    `${ JSON.stringify(LAUNCH) }\n${ JSON.stringify({ ...BACKGROUND_END, outputFile }) }\n`,
  );

  assert.match(
    runStatus([dataDir, 's1'], makeTempDir(t)).stdout,
    /\nlaunches this session: 0\nwaiting on Bash for \d+ min: \[deep\] S2 x\n$/u,
  );
});

test('names a background launch with no transcript after the three lines', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, RECORD_FILE), `${ JSON.stringify(BACKGROUND_END) }\n`);

  assert.match(
    runStatus([dataDir, 's1'], makeTempDir(t)).stdout,
    /\nlaunches this session: 0\nno transcript to read: delegator:finisher\n$/u,
  );
});

test('runs through run.sh', (t) => {
  const run = spawnSync(
    'bash',
    [RUN_SH, 'claude/delegator/status', makeTempDir(t), 's1'],
    { cwd: makeTempDir(t), encoding: 'utf8', timeout: SUBPROCESS_TIMEOUT_MS },
  );

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.match(run.stdout, /^mode: on \(default\)\n/u);
});

for (const [name, args] of [
  ['an empty data dir', ['', 's1']],
  ['an unsafe id', ['/data', '../s1']],
  ['an empty id', ['/data', '']],
  ['a missing id', ['/data']],
  ['no arguments', []],
  ['an extra argument', ['/data', 's1', 'extra']],
] as const) {
  test(`refuses ${ name } with one usage line, exit 2 and no output`, (t) => {
    const cwd = makeTempDir(t);
    const run = runStatus(args, cwd);

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /^yapus delegator status: usage: [^\n]*\n$/u);
    assert.deepEqual(readdirSync(cwd), []);
  });
}

function runStatus(args: readonly string[], cwd: string) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
