import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  type EndRow,
  type LaunchRow,
  RECORD_FILE,
  type ResumeRow,
  type ReturnRow,
  type Row,
} from '../../../../../hooks/claude/delegator/record-row.ts';
import { getWaits } from '../../../../../hooks/claude/delegator/status/get-waits.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const NOW = new Date('2026-11-18T12:00:00Z');
const WAITING = 'waiting on Bash for 90 min: [deep] S2 x\n';
const UNREADABLE = 'no transcript to read: [deep] S2 x\n';
// More than the bytes the status reads from the end of a transcript.
const OVER_TAIL_CHARACTERS = 70000;

const LAUNCH: LaunchRow = {
  time: '2026-11-18T10:00:00Z',
  hook: 'launch',
  sessionId: 's1',
  subject: 'delegator:finisher',
  allowed: true,
  reason: '',
  description: '[deep] S2 x',
  toolUseId: 'toolu_1',
  promptId: undefined,
  model: undefined,
  effort: undefined,
  callerId: undefined,
};
const END: EndRow = {
  time: '2026-11-18T10:00:01Z',
  hook: 'end',
  sessionId: 's1',
  subject: 'delegator:finisher',
  promptId: undefined,
  toolUseId: 'toolu_1',
  agentId: 'a1',
  status: 'async_launched',
  model: undefined,
  outputFile: undefined,
  durationMs: undefined,
  tokens: undefined,
  toolUses: undefined,
  word: undefined,
  length: undefined,
  capped: false,
};
const RETURN: ReturnRow = {
  time: '2026-11-18T11:00:00Z',
  hook: 'return',
  sessionId: 's1',
  subject: 'delegator:finisher',
  allowed: true,
  reason: '',
  agentId: 'a1',
  status: 'DONE',
  verdict: undefined,
  length: 40,
  turns: undefined,
  toolUses: undefined,
  tokens: undefined,
  durationMs: undefined,
  model: undefined,
};
const RESUME: ResumeRow = {
  time: '2026-11-18T11:10:00Z',
  hook: 'resume',
  sessionId: 's1',
  agentId: 'a1',
  toolUseId: 'toolu_2',
};

// A Bash call stamped 90 minutes and 59 seconds before NOW.
const BASH_CALL = makeCall('call_1', 'Bash', '2026-11-18T10:29:01Z');

test('prints the tool, the whole minutes and the description of a call with no result', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('prints the agent type when no launch row has the call id of the end row', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [
    { ...LAUNCH, toolUseId: undefined },
    { ...END, toolUseId: undefined, outputFile },
  ]);

  assert.equal(getWaits(dataDir, 's1', NOW), 'waiting on Bash for 90 min: delegator:finisher\n');
});

test('prints the older of two calls with no result', (t) => {
  const outputFile = writeTranscript(t, [
    makeCall('call_0', 'Agent', '2026-11-18T10:00:00Z'),
    BASH_CALL,
  ]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), 'waiting on Agent for 120 min: [deep] S2 x\n');
});

test('prints the call with no result after one that has its result', (t) => {
  const outputFile = writeTranscript(t, [
    makeCall('call_0', 'Read', '2026-11-18T10:00:00Z'),
    makeResult('call_0'),
    BASH_CALL,
  ]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('prints no line for a transcript whose every call has a result', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL, makeResult('call_1')]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), '');
});

test('prints one line for each launch, in the order of the record', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [
    LAUNCH,
    { ...END, outputFile },
    { ...END, toolUseId: 'toolu_9', agentId: 'a9', subject: 'delegator:reader' },
  ]);

  assert.equal(
    getWaits(dataDir, 's1', NOW),
    `${ WAITING }no transcript to read: delegator:reader\n`,
  );
});

test('prints no line for a launch that returned with a word of the contract', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }, RETURN]);

  assert.equal(getWaits(dataDir, 's1', NOW), '');
});

test('prints the line of a launch resumed after its return', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }, RETURN, RESUME]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('prints the line of a launch whose newest return opens with another word', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [
    LAUNCH,
    { ...END, outputFile },
    RETURN,
    { ...RETURN, time: '2026-11-18T11:20:00Z', status: 'Waiting' },
  ]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('prints the line of a launch whose return was sent back', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [
    LAUNCH,
    { ...END, outputFile },
    { ...RETURN, allowed: false, reason: 'over the cap' },
  ]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('prints the line of a launch when only another subagent returned', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }, { ...RETURN, agentId: 'a9' }]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('names a launch whose output file does not exist', (t) => {
  const outputFile = join(makeTempDir(t), 'missing.output');
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), UNREADABLE);
});

test('names a launch whose output file is a directory', (t) => {
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile: makeTempDir(t) }]);

  assert.equal(getWaits(dataDir, 's1', NOW), UNREADABLE);
});

test('names a launch whose end row has no output file', (t) => {
  const dataDir = writeRecord(t, [LAUNCH, END]);

  assert.equal(getWaits(dataDir, 's1', NOW), UNREADABLE);
});

test('names a launch whose output file holds no line that parses', (t) => {
  const outputFile = writeTranscript(t, ['{"type":"assistant"', '3']);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), UNREADABLE);
});

test('reads only the end of a transcript longer than the tail', (t) => {
  const outputFile = writeTranscript(t, [
    makeCall('call_0', 'Agent', '2026-11-18T10:00:00Z'),
    JSON.stringify({ type: 'user', filler: 'x'.repeat(OVER_TAIL_CHARACTERS) }),
    BASH_CALL,
  ]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('reads a transcript whose last line is cut as the lines before it', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL, makeResult('call_1').slice(0, 40)]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('takes no call from a line without a time', (t) => {
  const outputFile = writeTranscript(t, [
    JSON.stringify({
      type: 'api-request-blob',
      message: { content: [{ type: 'tool_use', id: 'call_0', name: 'Agent', input: {} }] },
    }),
    BASH_CALL,
  ]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), WAITING);
});

test('prints no line for an end row of another session', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, outputFile }]);

  assert.equal(getWaits(dataDir, 's2', NOW), '');
});

test('prints no line for a completed end row', (t) => {
  const outputFile = writeTranscript(t, [BASH_CALL]);
  const dataDir = writeRecord(t, [LAUNCH, { ...END, status: 'completed', outputFile }]);

  assert.equal(getWaits(dataDir, 's1', NOW), '');
});

test('prints no line without a record file', (t) => {
  assert.equal(getWaits(makeTempDir(t), 's1', NOW), '');
});

// A data dir whose record holds the rows, one JSON line each.
function writeRecord(t: TestContext, rows: readonly Row[]): string {
  const dataDir = makeTempDir(t);

  writeFileSync(
    join(dataDir, RECORD_FILE),
    rows.map((row) => `${ JSON.stringify(row) }\n`).join(''),
  );

  return dataDir;
}

// The path of a transcript file that holds the lines.
function writeTranscript(t: TestContext, lines: readonly string[]): string {
  const outputFile = join(makeTempDir(t), 'a1.output');

  writeFileSync(outputFile, lines.join('\n'));

  return outputFile;
}

// An assistant line with one tool call, as a transcript holds it.
function makeCall(id: string, name: string, timestamp: string): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    message: { content: [{ type: 'tool_use', id, name, input: {} }] },
  });
}

// The user line that answers the call.
function makeResult(id: string): string {
  return JSON.stringify({
    type: 'user',
    timestamp: '2026-11-18T10:30:00Z',
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
  });
}
