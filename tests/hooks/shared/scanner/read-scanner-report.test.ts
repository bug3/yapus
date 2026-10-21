import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readScannerReport } from '../../../../hooks/shared/scanner/read-scanner-report.ts';

test('reads the rule, file and line of each finding and nothing else', () => {
  const reportText = '[{"RuleID":"r1","File":"a.ts","StartLine":3,"Secret":"REDACTED"},'
    + '{"RuleID":"r2","File":"b.ts","StartLine":9}]';

  assert.deepEqual(readScannerReport(reportText), [
    { ruleId: 'r1', file: 'a.ts', startLine: 3 },
    { ruleId: 'r2', file: 'b.ts', startLine: 9 },
  ]);
});

test('refuses text that is not JSON', () => {
  assert.deepEqual(readScannerReport('['), { violation: 'the report is not JSON' });
});

test('refuses a report that is not a list', () => {
  assert.deepEqual(readScannerReport('{}'), {
    violation: 'the report is not a list with a finding',
  });
});

test('refuses an empty list, which exit 3 never writes', () => {
  assert.deepEqual(readScannerReport('[]'), {
    violation: 'the report is not a list with a finding',
  });
});

test('refuses a finding without a line', () => {
  assert.deepEqual(readScannerReport('[{"RuleID":"r1","File":"a.ts"}]'), {
    violation: 'a finding of the report lacks RuleID, File or StartLine',
  });
});
