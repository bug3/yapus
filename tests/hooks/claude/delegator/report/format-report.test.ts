import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatReport,
  type Report,
} from '../../../../../hooks/claude/delegator/report/format-report.ts';

const REPORT: Report = {
  path: '/d/decisions.jsonl',
  rowCount: 3,
  skipped: 1,
  sessions: 1,
  first: 't1',
  last: 't3',
  stats: [{
    agent: 'delegator:runner',
    launches: 1,
    refused: 0,
    completed: 1,
    capped: 0,
    noReturn: 2,
    returns: 1,
    sentBack: 0,
    contractWords: 1,
    verdicts: { APPROVE: 1 },
    durationMedianMs: 1444,
    tokensMedian: 3737.5,
    toolUsesMedian: undefined,
  }],
  findings: [{
    rule: 'cap-stop rate',
    agent: 'delegator:runner',
    value: '0 of 1, 0 percent',
    n: 1,
    threshold: 'over 30 percent at n 20',
    state: 'wait',
  }],
  refusals: [],
};

test('writes the extent, one row per agent with rounded medians and the findings', () => {
  const markdown = formatReport(REPORT);

  assert.match(markdown, /^# providens record report\n\nRecord `\/d\/decisions\.jsonl`: 3 rows, 1 skipped, 1 sessions, from t1 to t3\.\n/u);
  assert.match(markdown, /\| completed \| capped \| no return \| returns \|/u);
  assert.match(markdown, /\n\| delegator:runner \| 1 \| 0 \| 1 \| 0 \| 2 \| 1 \| 0 \| 1 \| APPROVE 1 \| 1 \| 3738 \| - \|\n/u);
  assert.match(markdown, /\n\| cap-stop rate \| delegator:runner \| 0 of 1, 0 percent \| 1 \| over 30 percent at n 20 \| wait \|\n/u);
  assert.match(markdown, /\n## Refusals\n\nNo refusals\.\n$/u);
});

test('writes the refusals as a table and no span for an empty record', () => {
  const markdown = formatReport({
    ...REPORT, first: undefined, last: undefined, refusals: [['r', 2]],
  });

  assert.match(markdown, /: 3 rows, 1 skipped, 1 sessions\.\n/u);
  assert.match(markdown, /\n\| reason \| count \|\n\|---\|---\|\n\| r \| 2 \|\n$/u);
});
