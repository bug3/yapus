import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/tyler/launch/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIELDS = {
  session_id: 's1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'providens:deacon', description: '[deep] Find x' },
};
const CALL = JSON.stringify(FIELDS);

test('allows a roster launch, counts it and logs it', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getVerdict({ stdinText: CALL, dataDir, time: 't' }), { kind: 'allow' });
  assert.equal(readFileSync(join(dataDir, 'launches', 's1.log'), 'utf8'), '+\n');
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":true/);
});

test('logs the description and the keys the payload carries, and no absent key', (t) => {
  const dataDir = makeTempDir(t);
  const call = JSON.stringify({ ...FIELDS, tool_use_id: 'toolu_1', effort: { level: 'high' } });

  getVerdict({ stdinText: call, dataDir, time: 't' });

  const line = readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8');

  assert.match(line, /"description":"\[deep\] Find x","toolUseId":"toolu_1","effort":"high"/);
  assert.doesNotMatch(line, /promptId|model/);
});

test('denies a nested launch, logs why and leaves the budget alone', (t) => {
  const dataDir = makeTempDir(t);
  const nested = JSON.stringify({ ...FIELDS, agent_id: 'a1' });

  assert.deepEqual(getVerdict({ stdinText: nested, dataDir, time: 't' }), {
    kind: 'deny',
    detail: 'a subagent launches no agents; return the work to your caller',
  });
  assert.equal(existsSync(join(dataDir, 'launches')), false);
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":false/);
});

test('denies when the plugin data directory is unset or empty', () => {
  const verdicts = [
    getVerdict({ stdinText: CALL, dataDir: undefined, time: 't' }),
    getVerdict({ stdinText: CALL, dataDir: '', time: 't' }),
  ];
  const denial = { kind: 'deny', detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin' };

  assert.deepEqual(verdicts, [denial, denial]);
});

test('denies stdin it cannot read, without a log line', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getVerdict({ stdinText: '{', dataDir, time: 't' }), {
    kind: 'deny',
    detail: 'stdin is not JSON; the launch is blocked',
  });
  assert.equal(existsSync(join(dataDir, 'decisions.jsonl')), false);
});
