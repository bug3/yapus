import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getReport } from '../../../../../hooks/claude/delegator/report/get-report.ts';

const LINES = [
  '{"time":"2026-10-24T16:02:11Z","hook":"launch","sessionId":"s1","subject":"delegator:runner",'
    + '"allowed":true,"reason":"","description":"[standard] S1 run it","toolUseId":"t1"}',
  '{"time":"2026-10-24T16:02:12Z","hook":"return","sessionId":"s1","subject":"delegator:runner",'
    + '"allowed":true,"reason":"","agentId":"a1","status":"DONE","length":43}',
  '{"time":"2026-10-24T16:02:13Z","hook":"end","sessionId":"s1","subject":"delegator:runner",'
    + '"toolUseId":"t1","agentId":"a1","status":"completed","durationMs":1444,"capped":false}',
  'not a row',
  '{"time":"2026-10-24T16:03:00Z","hook":"launch","sessionId":"s2","subject":"delegator:reader",'
    + '"allowed":false,"reason":"start the description with the depth in brackets",'
    + '"description":"x"}',
];

test('reports the extent, the agent types, the rules and the refusals of a record text', () => {
  const markdown = getReport('/d/decisions.jsonl', `${ LINES.join('\n') }\n`);

  assert.match(
    markdown,
    /: 4 rows, 1 skipped, 2 sessions, from 2026-10-24T16:02:11Z to 2026-10-24T16:03:00Z\.\n/u,
  );
  assert.match(
    markdown,
    /\n\| delegator:reader \| 0 \| 1 \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| {2}\| - \| - \| - \|\n/u,
  );
  assert.match(
    markdown,
    /\n\| delegator:runner \| 1 \| 0 \| 1 \| 0 \| 0 \| 1 \| 0 \| 1 \| {2}\| 1 \| - \| - \|\n/u,
  );
  assert.match(markdown, /\n\| unused agent \| delegator:builder \| 0 launches in 2 sessions \| 2 \| /u);
  assert.match(markdown, /\n\| start the description with the depth in brackets \| 1 \|\n$/u);
});
