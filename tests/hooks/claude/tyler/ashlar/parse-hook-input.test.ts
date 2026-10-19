import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHookInput } from '../../../../../hooks/claude/tyler/ashlar/parse-hook-input.ts';

const FIELDS = { session_id: 's1', cwd: '/work', hook_event_name: 'SubagentStop' };

test('maps every field of a full payload', () => {
  const parsed = parseHookInput(JSON.stringify({
    ...FIELDS,
    agent_id: 'a1',
    last_assistant_message: 'DONE',
    stop_hook_active: true,
  }));

  assert.deepEqual(parsed, {
    kind: 'input',
    input: {
      sessionId: 's1',
      cwd: '/work',
      event: 'SubagentStop',
      agentId: 'a1',
      message: 'DONE',
      isRetry: true,
    },
  });
});

test('leaves out the optional fields a payload lacks', () => {
  const parsed = parseHookInput(JSON.stringify(FIELDS));

  assert.deepEqual(parsed, {
    kind: 'input',
    input: { sessionId: 's1', cwd: '/work', event: 'SubagentStop', isRetry: false },
  });
});

test('fails on a missing session_id', () => {
  const parsed = parseHookInput(JSON.stringify({ cwd: '/work', hook_event_name: 'Stop' }));

  assert.equal(parsed.kind, 'failure');
});

test('fails on an unsafe session_id', () => {
  const parsed = parseHookInput(JSON.stringify({ ...FIELDS, session_id: '../x' }));

  assert.equal(parsed.kind, 'failure');
});

test('fails on a missing cwd', () => {
  const parsed = parseHookInput(JSON.stringify({ session_id: 's1', hook_event_name: 'Stop' }));

  assert.equal(parsed.kind, 'failure');
});

test('fails on a missing hook_event_name', () => {
  const parsed = parseHookInput(JSON.stringify({ session_id: 's1', cwd: '/work' }));

  assert.equal(parsed.kind, 'failure');
});

test('fails on a non-boolean stop_hook_active', () => {
  const parsed = parseHookInput(JSON.stringify({ ...FIELDS, stop_hook_active: 'yes' }));

  assert.deepEqual(parsed, {
    kind: 'failure',
    reason: 'stop_hook_active is not a boolean',
    isRetry: false,
  });
});

test('fails on non-JSON with isRetry false', () => {
  const parsed = parseHookInput('not json');

  assert.deepEqual(parsed, { kind: 'failure', reason: 'stdin is not JSON', isRetry: false });
});

test('fails on a bad session_id with isRetry true when stop_hook_active is true', () => {
  const parsed = parseHookInput(JSON.stringify({
    ...FIELDS,
    session_id: '../x',
    stop_hook_active: true,
  }));

  assert.equal(parsed.kind === 'failure' && parsed.isRetry, true);
});
