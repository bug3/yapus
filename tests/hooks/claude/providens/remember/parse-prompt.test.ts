import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePrompt } from '../../../../../hooks/claude/providens/remember/parse-prompt.ts';

test('reads the session and the text of a submitted prompt', () => {
  const stdinText = JSON.stringify({ session_id: 's1', cwd: '/work/app', prompt: 'go\non' });

  assert.deepEqual(parsePrompt(stdinText), {
    kind: 'prompt',
    prompt: { sessionId: 's1', text: 'go\non' },
  });
});

test('fails on stdin that is not a JSON object', () => {
  assert.deepEqual(
    [parsePrompt('{').kind, parsePrompt('null').kind, parsePrompt('"go"').kind],
    ['failure', 'failure', 'failure'],
  );
});

test('fails on an unsafe session id', () => {
  assert.deepEqual(parsePrompt(JSON.stringify({ session_id: '../s1', prompt: 'go' })), {
    kind: 'failure',
    reason: 'session_id is not letters, digits and hyphens',
  });
});

test('fails when the prompt is not a string', () => {
  assert.deepEqual(parsePrompt(JSON.stringify({ session_id: 's1', prompt: 3 })), {
    kind: 'failure',
    reason: 'prompt is not a string',
  });
});
