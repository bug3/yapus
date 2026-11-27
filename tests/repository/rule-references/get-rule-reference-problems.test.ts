import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeTempFiles } from '../../helpers/make-temp-repo.ts';
import { getRuleReferenceProblems } from './get-rule-reference-problems.ts';

const STANDARD = { path: 'standards/A.md', text: '# A\n\n## A-1. Do x.\n' };
const POLICY = { path: 'hooks/claude/delegator/policy/policy.md', text: '# Z\n\n## Z-1. Do y.\n' };

test('finds nothing when every cited ID names a rule of a standard or the policy', (t) => {
  const root = makeTempFiles(t, [STANDARD, POLICY, { path: 'a.ts', text: '// A-1 and Z-1.\n' }]);

  assert.deepEqual(getRuleReferenceProblems(root), []);
});

test('names a cited ID that no rule heading defines', (t) => {
  const root = makeTempFiles(t, [STANDARD, { path: 'a.ts', text: '// x\n// A-1, then A-2.\n' }]);

  assert.deepEqual(getRuleReferenceProblems(root), ['a.ts:2: A-2 names no rule']);
});

test('skips a word whose prefix no rule heading uses', (t) => {
  const root = makeTempFiles(t, [STANDARD, { path: 'a.ts', text: '// UTF-8 and B-2.\n' }]);

  assert.deepEqual(getRuleReferenceProblems(root), []);
});
