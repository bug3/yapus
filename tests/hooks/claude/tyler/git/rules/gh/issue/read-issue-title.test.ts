import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readIssueTitle,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/issue/read-issue-title.ts';

test('reads the scope and symptom of an issue title', () => {
  assert.deepEqual(readIssueTitle('git-gate: crashes on start'), {
    scope: 'git-gate',
    symptom: 'crashes on start',
  });
});

test('reads nothing from a title without a colon and space', () => {
  assert.equal(readIssueTitle('crashes on start'), undefined);
  assert.equal(readIssueTitle('hooks:crash'), undefined);
});

test('reads nothing from a title with an empty symptom', () => {
  assert.equal(readIssueTitle('hooks: '), undefined);
});

test('reads nothing from a scope in a form the catalogs never hold', () => {
  assert.equal(readIssueTitle('Hooks: crash'), undefined);
});

test('accepts a title of 72 characters and refuses one of 73', () => {
  assert.deepEqual(readIssueTitle(`hooks: ${ 'x'.repeat(65) }`)?.scope, 'hooks');
  assert.equal(readIssueTitle(`hooks: ${ 'x'.repeat(66) }`), undefined);
});
