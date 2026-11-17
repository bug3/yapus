import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWrite } from '../../../../../hooks/claude/delegator/link/parse-write.ts';

const WRITE = {
  session_id: 's1',
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: '/project/.yapus/plans/2026-11/topic/S1.md', content: 'a' },
};

test('reads the session and the file path of a Write', () => {
  assert.deepEqual(parseWrite(JSON.stringify(WRITE)), {
    kind: 'write',
    write: { sessionId: 's1', filePath: '/project/.yapus/plans/2026-11/topic/S1.md' },
  });
});

test('reads the session and the file path of an Edit', () => {
  const stdinText = JSON.stringify({
    ...WRITE,
    tool_name: 'Edit',
    tool_input: { file_path: '/root/a.md', old_string: 'a', new_string: 'b', replace_all: false },
  });

  assert.deepEqual(parseWrite(stdinText), {
    kind: 'write',
    write: { sessionId: 's1', filePath: '/root/a.md' },
  });
});

// The path in the tool's response and the payload's cwd name no file to link.
test('takes the session of the main session and the path of the input alone', () => {
  const stdinText = JSON.stringify({
    ...WRITE,
    agent_id: 'a1',
    agent_type: 'delegator:finisher',
    cwd: '/elsewhere',
    tool_response: { type: 'create', filePath: '/elsewhere/b.md', content: 'a' },
  });

  assert.deepEqual(parseWrite(stdinText), {
    kind: 'write',
    write: { sessionId: 's1', filePath: '/project/.yapus/plans/2026-11/topic/S1.md' },
  });
});

test('fails on stdin that is not JSON', () => {
  assert.deepEqual(parseWrite('{'), { kind: 'failure', reason: 'stdin is not JSON' });
});

test('fails on stdin that is not a JSON object', () => {
  assert.deepEqual(parseWrite('[]'), { kind: 'failure', reason: 'stdin is not a JSON object' });
});

test('fails on a session id that is not safe as a file name', () => {
  assert.deepEqual(parseWrite(JSON.stringify({ ...WRITE, session_id: '../s1' })), {
    kind: 'failure',
    reason: 'session_id is not letters, digits and hyphens',
  });
});

test('fails on a tool input that is not an object', () => {
  assert.deepEqual(parseWrite(JSON.stringify({ ...WRITE, tool_input: 'a.md' })), {
    kind: 'failure',
    reason: 'tool_input is not a JSON object',
  });
});

test('fails on a file path that is missing or not a string', () => {
  const failure = { kind: 'failure', reason: 'tool_input.file_path is not a string' };

  assert.deepEqual(
    [
      parseWrite(JSON.stringify({ ...WRITE, tool_input: { content: 'a' } })),
      parseWrite(JSON.stringify({ ...WRITE, tool_input: { file_path: 7 } })),
    ],
    [failure, failure],
  );
});
