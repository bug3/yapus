import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLS, parsePayload } from '../../../hooks/m6/parse-payload.ts';

const FILE_PATH = '/repo/a.md';
const LONE_SURROGATE = String.fromCharCode(0xd803);

test('handles exactly Write and Edit', () => {
  assert.deepEqual(TOOLS, ['Write', 'Edit']);
});

test('parses a Write call', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: FILE_PATH, content: 'text' },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'call',
    call: { tool: 'Write', filePath: FILE_PATH, content: 'text' },
  });
});

test('parses an Edit call with replace_all', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: FILE_PATH, old_string: 'x', new_string: 'y', replace_all: true },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'call',
    call: { tool: 'Edit', filePath: FILE_PATH, oldString: 'x', newString: 'y' },
  });
});

test('parses an Edit call without replace_all', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: FILE_PATH, old_string: 'x', new_string: 'y' },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'call',
    call: { tool: 'Edit', filePath: FILE_PATH, oldString: 'x', newString: 'y' },
  });
});

test('fails on stdin that is not JSON', () => {
  assert.deepEqual(parsePayload('{'), { kind: 'failure', reason: 'stdin is not JSON' });
});

test('fails on stdin that is a JSON array', () => {
  assert.deepEqual(parsePayload('[]'), { kind: 'failure', reason: 'stdin is not a JSON object' });
});

test('fails on a tool other than Write and Edit', () => {
  const stdinText = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_name "Bash" is not one of Write, Edit',
  });
});

test('fails on a missing tool_name', () => {
  assert.deepEqual(parsePayload('{"tool_input":{}}'), {
    kind: 'failure',
    reason: 'tool_name undefined is not one of Write, Edit',
  });
});

test('fails on a tool_name inherited from Object.prototype', () => {
  const stdinText = JSON.stringify({ tool_name: 'toString', tool_input: {} });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_name "toString" is not one of Write, Edit',
  });
});

test('fails on a tool_input that is not an object', () => {
  assert.deepEqual(parsePayload('{"tool_name":"Write","tool_input":"x"}'), {
    kind: 'failure',
    reason: 'tool_input is not a JSON object',
  });
});

test('fails on a Write without content', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: FILE_PATH },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.content is not a well-formed string',
  });
});

test('fails on an Edit whose new_string is not a string', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: FILE_PATH, old_string: 'x', new_string: 1 },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.new_string is not a well-formed string',
  });
});

test('fails on an Edit whose new_string holds a lone surrogate', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: FILE_PATH, old_string: 'x', new_string: LONE_SURROGATE },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.new_string is not a well-formed string',
  });
});

test('fails on a Write whose content holds a lone surrogate', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: FILE_PATH, content: LONE_SURROGATE },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.content is not a well-formed string',
  });
});

test('fails on a replace_all that is not a boolean', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: FILE_PATH, old_string: 'x', new_string: 'y', replace_all: 'yes' },
  });

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.replace_all is not a boolean',
  });
});

test('fails on a replace_all that is null', () => {
  const stdinText =
    '{"tool_name":"Edit","tool_input":{"file_path":"/repo/a.md","old_string":"x","new_string":"y","replace_all":null}}';

  assert.deepEqual(parsePayload(stdinText), {
    kind: 'failure',
    reason: 'tool_input.replace_all is not a boolean',
  });
});
