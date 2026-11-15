import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStart } from '../../../../../hooks/claude/delegator/recall/parse-start.ts';

test('reads the session id and the source of a SessionStart payload', () => {
  const stdinText = JSON.stringify({ session_id: 's1', source: 'compact', cwd: '/p' });

  assert.deepEqual(parseStart(stdinText), {
    kind: 'start',
    start: { sessionId: 's1', source: 'compact' },
  });
});

test('names what is wrong with a payload it cannot use', () => {
  assert.deepEqual(
    [
      parseStart('{'),
      parseStart('[]'),
      parseStart(JSON.stringify({ session_id: '../s1', source: 'compact' })),
      parseStart(JSON.stringify({ session_id: 's1' })),
    ],
    [
      { kind: 'failure', reason: 'stdin is not JSON' },
      { kind: 'failure', reason: 'stdin is not a JSON object' },
      { kind: 'failure', reason: 'session_id is not letters, digits and hyphens' },
      { kind: 'failure', reason: 'source is not a string' },
    ],
  );
});
