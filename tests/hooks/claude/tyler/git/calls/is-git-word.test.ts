import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isGitWord } from '../../../../../../hooks/claude/tyler/git/calls/is-git-word.ts';

test('accepts git', () => {
  assert.equal(isGitWord('git'), true);
});

test('accepts a path to git in any case', () => {
  assert.equal(isGitWord('/usr/bin/GIT'), true);
});

test('accepts a git subcommand program', () => {
  assert.equal(isGitWord('git-push'), true);
});

test('accepts gh', () => {
  assert.equal(isGitWord('gh'), true);
});

test('rejects gitk', () => {
  assert.equal(isGitWord('gitk'), false);
});

test('rejects digit', () => {
  assert.equal(isGitWord('digit'), false);
});

test('rejects .git', () => {
  assert.equal(isGitWord('.git'), false);
});
