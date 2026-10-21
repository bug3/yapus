import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ghCommands } from '../../../hooks/claude/tyler/gh/rules/gh-commands.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const { bodies } = ghCommands;

// The `##` headings of a file under the root, in order.
function readHeadings(path: string): readonly string[] {
  return readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice('## '.length));
}

test('gives the pull request template the headings the gate requires', () => {
  assert.deepEqual(readHeadings('.github/pull_request_template.md'), bodies.pr.headings);
});

test('gives the bug template the headings the gate requires of a bug', () => {
  assert.deepEqual(
    readHeadings('.github/ISSUE_TEMPLATE/bug.md'),
    bodies.issue.bug.headings,
  );
});

test('gives the feature template the headings the gate requires of a feature', () => {
  assert.deepEqual(
    readHeadings('.github/ISSUE_TEMPLATE/feature.md'),
    bodies.issue.feature.headings,
  );
});

test('gives the other template the headings the gate requires of other', () => {
  assert.deepEqual(
    readHeadings('.github/ISSUE_TEMPLATE/other.md'),
    bodies.issue.other.headings,
  );
});
