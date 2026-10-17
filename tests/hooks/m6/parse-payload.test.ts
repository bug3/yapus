import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLS, parsePayload } from '../../../hooks/m6/parse-payload.ts';

const FILE_PATH = '/repo/a.md';

test('handles exactly Write', () => {
  assert.deepEqual(TOOLS, ['Write']);
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

test('fails on stdin that is not JSON', () => {
  assert.deepEqual(parsePayload('{'), { kind: 'failure', reason: 'stdin is not JSON' });
});
