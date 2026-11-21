import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'dive', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
// Four workflow agents in two stages; a3 has no result row.
const JOURNAL = [
  '{"type":"started","agentId":"a1","label":"scope","phase":"Scope"}',
  '{"type":"result","agentId":"a1","result":{"questions":[]}}',
  '{"type":"started","agentId":"a2","label":"gather-repo:Q1","phase":"Gather"}',
  '{"type":"started","agentId":"a3","label":"gather-repo:Q2","phase":"Gather"}',
  '{"type":"started","agentId":"a4","label":"gather-repo:Q3","phase":"Gather"}',
  '{"type":"result","agentId":"a4","result":{"claims":[]}}',
  '{"type":"result","agentId":"a2","result":{"claims":[]}}',
  '',
].join('\n');
const SCOPE_TRANSCRIPT = [
  '{"type":"user","timestamp":"2026-01-01T00:00:00.000Z","message":{"content":"go"}}',
  '{"type":"assistant","timestamp":"2026-01-01T00:00:03.000Z","message":{"id":"m1","model":"model-a","usage":{"input_tokens":10,"output_tokens":5,"cache_creation_input_tokens":100,"cache_read_input_tokens":200},"content":[{"type":"tool_use","id":"t1","name":"Glob"}]}}',
  '',
].join('\n');
const GATHER_TRANSCRIPT = [
  '{"type":"assistant","timestamp":"2026-01-01T00:00:10.000Z","message":{"id":"m1","model":"model-b","usage":{"input_tokens":1,"output_tokens":2,"cache_read_input_tokens":3},"content":[{"type":"tool_use","id":"t1","name":"Read"}]}}',
  '{"type":"assistant","timestamp":"2026-01-01T00:00:40.000Z","message":{"id":"m2","model":"model-b","usage":{"input_tokens":1,"output_tokens":2,"cache_read_input_tokens":3},"content":[{"type":"tool_use","id":"t2","name":"Grep"}]}}',
  '',
].join('\n');
const REPORT = [
  '| Stage | Workflow agents | Returned | Turns | Output tokens | Input tokens | Cache-read tokens | Median s | Longest s | Models | Tools |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  '| scope | 1 | 1 | 1.0 | 5 | 110 | 200 | 3 | 3 | model-a | Glob 1 |',
  '| gather-repo | 3 | 2 | 1.3 | 8 | 4 | 12 | 30 | 30 | model-b | Grep 2, Read 2 |',
  '',
  'Total: 4 workflow agents, 13 output tokens, 114 input tokens, 212 cache-read tokens, 40 s from first to last',
  '',
].join('\n');
// One workflow agent that called Bash, a tool it does not hold, and Read,
// which ran.
const NOT_HELD_JOURNAL =
  '{"type":"started","agentId":"a1","label":"gather-repo:Q1","phase":"Gather"}\n';
const NOT_HELD_TRANSCRIPT = [
  '{"type":"assistant","message":{"id":"m1","content":[{"type":"tool_use","id":"t1","name":"Bash"}]}}',
  '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","is_error":true,"content":"<tool_use_error>Error: No such tool available: Bash. Bash is not among the tools available here. Continue with the tools you have.</tool_use_error>"}]}}',
  '{"type":"assistant","message":{"id":"m2","content":[{"type":"tool_use","id":"t2","name":"Read"}]}}',
  '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t2","content":"the text of a file"}]}}',
  '',
].join('\n');
const USAGE_LINE =
  'yapus delegator dive: usage: delegator dive <run directory>; give the directory of one workflow run and nothing else\n';

// The fourth workflow agent, a4, gets no transcript.
function makeRunDirectory(t: TestContext): string {
  const runDirectory = makeTempDir(t);

  writeFileSync(join(runDirectory, 'journal.jsonl'), JOURNAL);
  writeFileSync(join(runDirectory, 'agent-a1.jsonl'), SCOPE_TRANSCRIPT);
  writeFileSync(join(runDirectory, 'agent-a2.jsonl'), GATHER_TRANSCRIPT);
  writeFileSync(join(runDirectory, 'agent-a3.jsonl'), GATHER_TRANSCRIPT);

  return runDirectory;
}

test('exits 0 and prints the report of the run directory', (t) => {
  const run = runDive([makeRunDirectory(t)]);

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(run.stdout, REPORT);
});

test('prints a call of a tool the workflow agent did not hold after the tool it held', (t) => {
  const runDirectory = makeTempDir(t);

  writeFileSync(join(runDirectory, 'journal.jsonl'), NOT_HELD_JOURNAL);
  writeFileSync(join(runDirectory, 'agent-a1.jsonl'), NOT_HELD_TRANSCRIPT);

  assert.equal(
    runDive([runDirectory]).stdout.split('\n')[2],
    '| gather-repo | 1 | 0 | 2.0 | 0 | 0 | 0 | - | - | - | Read 1; not held: Bash 1 |',
  );
});

test('runs through run.sh', (t) => {
  const run = spawnSync(
    'bash',
    [RUN_SH, 'claude/delegator/dive', makeRunDirectory(t)],
    { cwd: makeTempDir(t), encoding: 'utf8', timeout: SUBPROCESS_TIMEOUT_MS },
  );

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(run.stdout, REPORT);
});

test('refuses no argument with the usage line, exit 2 and no output', () => {
  const run = runDive([]);

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.equal(run.stderr, USAGE_LINE);
});

test('refuses two arguments with the usage line, exit 2 and no output', (t) => {
  const run = runDive([makeRunDirectory(t), makeRunDirectory(t)]);

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.equal(run.stderr, USAGE_LINE);
});

test('exits 2 and names the journal of a directory that holds none', (t) => {
  const runDirectory = makeTempDir(t);
  const path = join(runDirectory, 'journal.jsonl');
  const run = runDive([runDirectory]);

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.equal(
    run.stderr,
    `yapus delegator dive: cannot read ${ path }: ENOENT: no such file or directory, `
      + `open '${ path }'; give the directory of one workflow run\n`,
  );
});

function runDive(args: readonly string[]) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
