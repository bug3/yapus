import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getScanVerdict } from '../../../../hooks/shared/scanner/get-scan-verdict.ts';

const TARGET = 'the staged change';

test('lets a clean scan go on without a word', () => {
  assert.deepEqual(getScanVerdict({ kind: 'clean' }, TARGET), { warnings: [], violations: [] });
});

test('warns in one line about a missing scanner and lets the work go on', () => {
  assert.deepEqual(getScanVerdict({ kind: 'missing', program: 'gitleaks' }, TARGET), {
    warnings: ['gitleaks is not installed; the staged change is not scanned'],
    violations: [],
  });
});

test('stops on a scanner failure and says to retry', () => {
  assert.deepEqual(getScanVerdict({ kind: 'failure', reason: 'exit 1: bad flag' }, TARGET), {
    warnings: [],
    violations: ['cannot scan the staged change (exit 1: bad flag); retry it'],
  });
});

test('names the rule, file and line of each finding and what to do', () => {
  const findings = [
    { ruleId: 'r1', file: 'a.ts', startLine: 3 },
    { ruleId: 'r2', file: 'b.ts', startLine: 9 },
  ];

  assert.deepEqual(getScanVerdict({ kind: 'findings', findings }, TARGET), {
    warnings: [],
    violations: [
      'secret found: rule r1, a.ts line 3',
      'secret found: rule r2, b.ts line 9',
      'stop and tell the person; if it was pushed, rotate it; do not rewrite history to hide it',
    ],
  });
});
