import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWrite } from '../../../../../hooks/claude/gates/memory/parse-write.ts';

test('reads the path and the content of a Write call', () => {
  const call = {
    session_id: 's1',
    tool_name: 'Write',
    tool_input: { file_path: '/config/projects/-work-app/memory/x.md', content: 'text\n' },
  };

  assert.deepEqual(parseWrite(JSON.stringify(call)), {
    kind: 'write',
    write: {
      filePath: '/config/projects/-work-app/memory/x.md',
      content: 'text\n',
      newString: undefined,
    },
  });
});

test('reads the path and the new text of an Edit call, which carries no content', () => {
  const call = {
    session_id: 's1',
    tool_name: 'Edit',
    tool_input: { file_path: '/work/app/x.md', old_string: 'a', new_string: 'b' },
  };

  assert.deepEqual(parseWrite(JSON.stringify(call)), {
    kind: 'write',
    write: { filePath: '/work/app/x.md', content: undefined, newString: 'b' },
  });
});

test('fails on stdin that is not JSON', () => {
  assert.deepEqual(parseWrite('{'), { kind: 'failure', reason: 'stdin is not JSON' });
});

test('fails on stdin that is not a JSON object', () => {
  assert.deepEqual(parseWrite('[]'), { kind: 'failure', reason: 'stdin is not a JSON object' });
});

test('fails on a payload with no tool input', () => {
  assert.deepEqual(parseWrite(JSON.stringify({ tool_name: 'Write' })), {
    kind: 'failure',
    reason: 'tool_input is not a JSON object',
  });
});

test('fails on a tool input with no file path', () => {
  assert.deepEqual(parseWrite(JSON.stringify({ tool_input: { content: 'text\n' } })), {
    kind: 'failure',
    reason: 'tool_input.file_path is not a string',
  });
});

test('fails on a content that is not a string', () => {
  const call = { tool_input: { file_path: '/work/app/x.md', content: 5 } };

  assert.deepEqual(parseWrite(JSON.stringify(call)), {
    kind: 'failure',
    reason: 'tool_input.content is not a string',
  });
});

test('fails on a new text that is not a string', () => {
  const call = { tool_input: { file_path: '/work/app/x.md', old_string: '', new_string: 5 } };

  assert.deepEqual(parseWrite(JSON.stringify(call)), {
    kind: 'failure',
    reason: 'tool_input.new_string is not a string',
  });
});
