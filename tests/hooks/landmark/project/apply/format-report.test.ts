import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatReport } from '../../../../../hooks/landmark/project/apply/format-report.ts';
import type { PackageMerge } from '../../../../../hooks/landmark/project/package/merge-package.ts';
import type { ProjectPlan } from '../../../../../hooks/landmark/project/plan/get-project-plan.ts';

const PLAN: ProjectPlan = {
  mode: 'install',
  writes: [],
  removals: [],
  created: ['a.txt'],
  changed: [],
};
const MERGE: PackageMerge = { text: '{}', set: ['type'], removed: [] };

test('prints the golangci-lint install, lint, test and commit steps for go', () => {
  const lines = formatReport(PLAN, ['a.txt'], { language: 'go', merge: undefined });

  assert.deepEqual(lines, [
    'yapus landmark project install: wrote',
    '  a.txt',
    'Next:',
    '  curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b "$(go env GOPATH)/bin" v2.15.0',
    '  golangci-lint run ./...',
    '  go test ./...',
    '  commit the changes',
    'To undo:',
    '  remove a.txt',
  ]);
});

test('prints the npm steps and the keys line for typescript with a merge', () => {
  const lines = formatReport(PLAN, ['a.txt'], { language: 'typescript', merge: MERGE });

  assert.deepEqual(lines, [
    'yapus landmark project install: wrote',
    '  a.txt',
    'package.json: set type',
    'Next:',
    '  npm install',
    '  npm test',
    '  commit the changes',
    'To undo:',
    '  remove a.txt',
  ]);
});
