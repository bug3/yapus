import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePayload } from '../../../../../../hooks/claude/tyler/git/input/parse-payload.ts';

const CWD = '/repo';
const LONE_SURROGATE = String.fromCharCode(0xd803);

test('parses a Bash call', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'git status' },
    cwd: CWD,
  });

  assert.deepEqual(parsePayload(stdinText), { kind: 'call', command: 'git status', cwd: CWD });
});

test('parses a Bash call and ignores the other fields', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Bash',
    tool_input: {
      command: 'git status',
      description: 'status',
      timeout: 1000,
      run_in_background: false,
    },
    cwd: CWD,
    session_id: 'abc',
  });

  assert.deepEqual(parsePayload(stdinText), { kind: 'call', command: 'git status', cwd: CWD });
});

test('returns other for a tool that is not Bash', () => {
  const stdinText = JSON.stringify({ tool_name: 'Write', tool_input: {}, cwd: CWD });

  assert.deepEqual(parsePayload(stdinText), { kind: 'other' });
});

test('fails on stdin that is not JSON', () => {
  assert.deepEqual(parsePayload('{'), { kind: 'failure', reason: 'stdin is not JSON' });
});

test('fails on stdin that is a JSON array', () => {
  assert.deepEqual(parsePayload('[]'), { kind: 'failure', reason: 'stdin is not a JSON object' });
});

test('fails on a missing tool_name', () => {
  assert.deepEqual(parsePayload('{"tool_input":{}}'), {
    kind: 'failure',
    reason: 'tool_name is not a string',
  });
});

test('fails on a Bash call whose tool_input is not an object', () => {
  assert.deepEqual(parsePayload('{"tool_name":"Bash","tool_input":"x","cwd":"/repo"}'), {
    kind: 'failure',
    reason: 'tool_input is not a JSON object',
  });
});

test('fails on a Bash call without a command', () => {
  const stdinText = JSON.stringify({ tool_name: 'Bash', tool_input: {}, cwd: CWD });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.command is not text',
  });
});

test('fails on a command that holds a lone surrogate', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: LONE_SURROGATE },
    cwd: CWD,
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.command is not text',
  });
});

test('fails on a Bash call without a cwd', () => {
  const stdinText = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'cwd is not an absolute path',
  });
});

test('fails on a relative cwd', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    cwd: 'repo',
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'cwd is not an absolute path',
  });
});

test('fails on a cwd that holds a lone surrogate', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    cwd: `/repo${ LONE_SURROGATE }`,
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'cwd is not an absolute path',
  });
});
