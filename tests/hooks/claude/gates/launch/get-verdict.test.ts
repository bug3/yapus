import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/gates/launch/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIELDS = {
  session_id: 's1',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'delegator:reader', description: '[deep] Find x' },
};
const CALL = JSON.stringify(FIELDS);

test('allows a roster launch, counts it and logs it', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getVerdict({ stdinText: CALL, dataDir, time: 't' }), { kind: 'allow' });
  assert.equal(readFileSync(join(dataDir, 'launches', 's1.log'), 'utf8'), '+\n');
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":true/);
});

test('allows an off-roster launch, counts it and logs it', (t) => {
  const dataDir = makeTempDir(t);
  const call = JSON.stringify({
    ...FIELDS, tool_input: { ...FIELDS.tool_input, subagent_type: 'claude-code-guide' },
  });

  assert.deepEqual(getVerdict({ stdinText: call, dataDir, time: 't' }), { kind: 'allow' });
  assert.equal(readFileSync(join(dataDir, 'launches', 's1.log'), 'utf8'), '+\n');
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":true/);
});

test('denies a general-purpose launch and logs it', (t) => {
  const dataDir = makeTempDir(t);
  const call = JSON.stringify({
    ...FIELDS, tool_input: { ...FIELDS.tool_input, subagent_type: 'general-purpose' },
  });

  assert.equal(getVerdict({ stdinText: call, dataDir, time: 't' }).kind, 'deny');
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":false/);
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
    detail: 'a subagent launches no subagent; return the work to your launcher',
  });
  assert.equal(existsSync(join(dataDir, 'launches')), false);
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":false/);
});

test('logs the caller id of a refused nested launch', (t) => {
  const dataDir = makeTempDir(t);

  getVerdict({ stdinText: JSON.stringify({ ...FIELDS, agent_id: 'a1' }), dataDir, time: 't' });

  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":false.*"callerId":"a1"/);
});

test('logs the caller id of an allowed nested launch', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'mode'), 'off');
  getVerdict({ stdinText: JSON.stringify({ ...FIELDS, agent_id: 'a1' }), dataDir, time: 't' });

  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":true.*"callerId":"a1"/);
});

test('logs a launch from the main session without a caller id', (t) => {
  const dataDir = makeTempDir(t);

  getVerdict({ stdinText: CALL, dataDir, time: 't' });

  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"launch","sessionId":"s1","subject":"delegator:reader","allowed":true,'
      + '"reason":"","description":"[deep] Find x"}\n',
  );
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

test('allows in off a launch every rule would refuse, records it and counts nothing', (t) => {
  const dataDir = makeTempDir(t);
  const launches = [
    { ...FIELDS, tool_input: { subagent_type: 'Explore', description: 'Find x' } },
    { ...FIELDS, agent_id: 'a1' },
    { ...FIELDS, tool_input: { ...FIELDS.tool_input, description: 'Find x' } },
    { ...FIELDS, tool_input: { ...FIELDS.tool_input, description: '[quick] Find x' } },
  ];

  writeFileSync(join(dataDir, 'mode'), 'off\n');

  const verdicts = launches.map((launch) => (
    getVerdict({ stdinText: JSON.stringify(launch), dataDir, time: 't' })
  ));
  const log = readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8');

  assert.deepEqual(verdicts, launches.map(() => ({ kind: 'allow' })));
  assert.equal(log.trim().split('\n').length, 4);
  assert.match(log, /"hook":"launch"/);
  assert.doesNotMatch(log, /"allowed":false/);
  assert.equal(existsSync(join(dataDir, 'launches')), false);
});

test('allows in off a session already at its limit and leaves its log alone', (t) => {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'launches'));
  writeFileSync(join(dataDir, 'launches', 's1.log'), '+\n');
  writeFileSync(join(dataDir, 'launch-limit'), '1');
  writeFileSync(join(dataDir, 'mode'), 'off');

  assert.deepEqual(getVerdict({ stdinText: CALL, dataDir, time: 't' }), { kind: 'allow' });
  assert.equal(readFileSync(join(dataDir, 'launches', 's1.log'), 'utf8'), '+\n');
});

test('keeps denying in off the unset data dir and the unparsable payload', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'mode'), 'off');

  assert.deepEqual(getVerdict({ stdinText: CALL, dataDir: undefined, time: 't' }), {
    kind: 'deny',
    detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin',
  });
  assert.deepEqual(getVerdict({ stdinText: '{', dataDir, time: 't' }), {
    kind: 'deny',
    detail: 'stdin is not JSON; the launch is blocked',
  });
});

test('obeys the session mode over the global mode', (t) => {
  const dataDir = makeTempDir(t);
  const nested = JSON.stringify({ ...FIELDS, agent_id: 'a1' });

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'mode'), 'off');
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'on');

  assert.equal(getVerdict({ stdinText: nested, dataDir, time: 't' }).kind, 'deny');

  writeFileSync(join(dataDir, 'mode'), 'on');
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'off');

  assert.equal(getVerdict({ stdinText: nested, dataDir, time: 't' }).kind, 'allow');
});

test('denies every launch naming an invalid mode file', (t) => {
  const sessionDir = makeTempDir(t);
  const globalDir = makeTempDir(t);
  const sessionFile = join(sessionDir, 'sessions', 's1.mode');
  const globalFile = join(globalDir, 'mode');

  mkdirSync(join(sessionDir, 'sessions'));
  writeFileSync(join(sessionDir, 'sessions', 's1.mode'), 'maybe');
  writeFileSync(join(globalDir, 'mode'), '');

  assert.deepEqual(getVerdict({ stdinText: CALL, dataDir: sessionDir, time: 't' }), {
    kind: 'deny',
    detail: `${ sessionFile } holds no mode; the person writes on or off there`,
  });
  assert.deepEqual(getVerdict({ stdinText: CALL, dataDir: globalDir, time: 't' }), {
    kind: 'deny',
    detail: `${ globalFile } holds no mode; the person writes on or off there`,
  });
  assert.equal(existsSync(join(sessionDir, 'launches')), false);
});
