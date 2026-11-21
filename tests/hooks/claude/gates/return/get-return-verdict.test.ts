import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getReturnVerdict,
} from '../../../../../hooks/claude/gates/return/get-return-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIELDS = { session_id: 's1', agent_type: 'delegator:reader' };
const SHORT = JSON.stringify({ ...FIELDS, last_assistant_message: 'a'.repeat(12000) });
const LONG_FIELDS = { ...FIELDS, last_assistant_message: 'a'.repeat(12001) };
const LONG = JSON.stringify(LONG_FIELDS);

test('passes a return at the cap and logs it', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getReturnVerdict({ stdinText: SHORT, dataDir, time: 't' }), { kind: 'pass' });
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"hook":"return".*"allowed":true/);
});

test('logs the agent id, the first words of the first two lines and the length', (t) => {
  const dataDir = makeTempDir(t);
  const message = 'DONE\n\nREWORK 2 defects\n';
  const stop = JSON.stringify({ ...FIELDS, agent_id: 'a1', last_assistant_message: message });

  getReturnVerdict({ stdinText: stop, dataDir, time: 't' });

  assert.match(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    /"agentId":"a1","status":"DONE","verdict":"REWORK","length":23/,
  );
});

test('logs no verdict for a return of one line', (t) => {
  const dataDir = makeTempDir(t);

  getReturnVerdict({ stdinText: SHORT, dataDir, time: 't' });

  assert.doesNotMatch(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /verdict/);
});

test('logs the totals of the transcript the payload names', (t) => {
  const dataDir = makeTempDir(t);
  const transcriptPath = join(dataDir, 'agent.jsonl');
  const first = {
    type: 'assistant',
    timestamp: '2026-01-01T00:00:00.000Z',
    message: {
      id: 'm1',
      model: 'model-a',
      usage: {
        input_tokens: 1,
        output_tokens: 2,
        cache_creation_input_tokens: 3,
        cache_read_input_tokens: 4,
      },
      content: [{ type: 'tool_use', id: 't1' }],
    },
  };
  const second = {
    type: 'assistant',
    timestamp: '2026-01-01T00:00:01.500Z',
    message: {
      id: 'm2',
      model: 'model-b',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        cache_creation_input_tokens: 1,
        cache_read_input_tokens: 1,
      },
      content: [{ type: 'text', text: 'done' }],
    },
  };

  writeFileSync(transcriptPath, `${ JSON.stringify(first) }\n${ JSON.stringify(second) }\n`);
  const stop = JSON.stringify({
    ...FIELDS,
    last_assistant_message: 'DONE',
    agent_transcript_path: transcriptPath,
  });

  getReturnVerdict({ stdinText: stop, dataDir, time: 't' });

  assert.match(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    /"turns":2,"toolUses":1,"tokens":4,"durationMs":1500,"model":"model-b"/,
  );
});

test('logs no totals when the payload names no transcript', (t) => {
  const dataDir = makeTempDir(t);

  getReturnVerdict({ stdinText: SHORT, dataDir, time: 't' });

  assert.doesNotMatch(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /turns/);
});

test('passes and logs no totals when the named transcript does not exist', (t) => {
  const dataDir = makeTempDir(t);
  const stop = JSON.stringify({
    ...FIELDS,
    last_assistant_message: 'DONE',
    agent_transcript_path: join(dataDir, 'missing.jsonl'),
  });

  assert.deepEqual(getReturnVerdict({ stdinText: stop, dataDir, time: 't' }), { kind: 'pass' });
  assert.doesNotMatch(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"turns"/);
});

test('sends back a first return over the cap and says why', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getReturnVerdict({ stdinText: LONG, dataDir, time: 't' }), {
    kind: 'shorten',
    detail: 'the return has 12001 characters, over the cap of 12000; return the most useful '
      + 'part, say what was cut and name the follow-up questions',
  });
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":false/);
});

test('passes a second return over the cap and logs its length', (t) => {
  const dataDir = makeTempDir(t);
  const retry = JSON.stringify({ ...LONG_FIELDS, stop_hook_active: true });

  assert.deepEqual(getReturnVerdict({ stdinText: retry, dataDir, time: 't' }), { kind: 'pass' });
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"reason":"12001 characters"/);
});

// A log written to an empty directory name would throw, so passing is the
// proof that none was tried.
test('judges without a log when the plugin data directory is empty', () => {
  const verdict = getReturnVerdict({ stdinText: SHORT, dataDir: '', time: 't' });

  assert.deepEqual(verdict, { kind: 'pass' });
});

test('passes the return of a workflow agent over the cap and logs nothing', (t) => {
  const dataDir = makeTempDir(t);
  const stop = JSON.stringify({
    ...LONG_FIELDS,
    agent_transcript_path: join(dataDir, 'agent-a1.jsonl'),
  });

  writeFileSync(join(dataDir, 'agent-a1.meta.json'), '{"inWorkflowRun":true}');

  assert.deepEqual(getReturnVerdict({ stdinText: stop, dataDir, time: 't' }), { kind: 'pass' });
  assert.deepEqual(readdirSync(dataDir), ['agent-a1.meta.json']);
});

test('blocks a stop without its message and logs nothing', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getReturnVerdict({ stdinText: JSON.stringify(FIELDS), dataDir, time: 't' }), {
    kind: 'shorten',
    detail: 'agent_type, last_assistant_message or stop_hook_active is missing; '
      + 'the stop is blocked',
  });
  assert.deepEqual(readdirSync(dataDir), []);
});

test('blocks a stop it cannot read', () => {
  assert.deepEqual(getReturnVerdict({ stdinText: '{', dataDir: undefined, time: 't' }), {
    kind: 'shorten',
    detail: 'stdin is not JSON; the stop is blocked',
  });
});
