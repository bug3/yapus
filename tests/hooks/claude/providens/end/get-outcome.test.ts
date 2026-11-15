import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getOutcome } from '../../../../../hooks/claude/providens/end/get-outcome.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const END = JSON.stringify({
  session_id: 's1',
  tool_name: 'Agent',
  tool_use_id: 'toolu_1',
  tool_input: { subagent_type: 'delegator:runner', description: '[standard] run it' },
  tool_response: {
    status: 'completed',
    agentId: 'a1',
    content: [{ type: 'text', text: 'DONE\nok' }],
    totalDurationMs: 40,
  },
});

test('records a completed launch as one end row, leaving absent fields out', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getOutcome({ stdinText: END, dataDir, time: 't' }), { kind: 'recorded' });
  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"end","sessionId":"s1","subject":"delegator:runner","toolUseId":"toolu_1",'
      + '"agentId":"a1","status":"completed","durationMs":40,"word":"DONE","length":7,'
      + '"capped":false}\n',
  );
});

test('fails without a row when the plugin data directory is unset or empty', () => {
  const outcomes = [
    getOutcome({ stdinText: END, dataDir: undefined, time: 't' }),
    getOutcome({ stdinText: END, dataDir: '', time: 't' }),
  ];
  const failure = {
    kind: 'failure',
    detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin',
  };

  assert.deepEqual(outcomes, [failure, failure]);
});

test('fails without a row on stdin it cannot read', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getOutcome({ stdinText: '{', dataDir, time: 't' }), {
    kind: 'failure',
    detail: 'stdin is not JSON; the end is not recorded',
  });
  assert.equal(existsSync(join(dataDir, 'decisions.jsonl')), false);
});
