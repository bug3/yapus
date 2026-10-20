import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mentionsGit } from '../../../../../hooks/claude/tyler/git/mentions-git.ts';

test('mentions git as a bare word', () => {
  assert.equal(mentionsGit('git status'), true);
});

test('mentions gh as a bare word', () => {
  assert.equal(mentionsGit('gh pr list'), true);
});

test('mentions git given by a path', () => {
  assert.equal(mentionsGit('/usr/bin/git status'), true);
});

test('mentions git inside quotes', () => {
  assert.equal(mentionsGit("echo 'git push'"), true);
});

test('mentions git in upper case', () => {
  assert.equal(mentionsGit('GIT status'), true);
});

test('mentions a git-name program', () => {
  assert.equal(mentionsGit('git-lfs pull'), true);
});

test('mentions git on the right of an assignment', () => {
  assert.equal(mentionsGit('A=git'), true);
});

test('mentions git after a command separator', () => {
  assert.equal(mentionsGit('ls;git push'), true);
});

test('mentions git alone', () => {
  assert.equal(mentionsGit('git'), true);
});

test('does not mention git in the word digit', () => {
  assert.equal(mentionsGit('digit'), false);
});

test('does not mention git in a .git path', () => {
  assert.equal(mentionsGit('cat .git/hooks'), false);
});

test('does not mention git in the word gitk', () => {
  assert.equal(mentionsGit('gitk --all'), false);
});

test('does not mention git in a host name', () => {
  assert.equal(mentionsGit('curl github.com'), false);
});

test('does not mention git in text without it', () => {
  assert.equal(mentionsGit('ls -la'), false);
});

test('mentions git joined by a backslash or by quotes', () => {
  assert.equal(mentionsGit('g\\it push'), true);
  assert.equal(mentionsGit("g''it push"), true);
  assert.equal(mentionsGit('"g"it push'), true);
});

test('mentions git inside a brace or beside a glob', () => {
  assert.equal(mentionsGit('{git,push,--force}'), true);
  assert.equal(mentionsGit('ls *git*'), true);
});

test('mentions git split by a line continuation', () => {
  assert.equal(mentionsGit('g\\\nit push'), true);
});

test('mentions git after an ANSI-C quote mark', () => {
  assert.equal(mentionsGit("$'git' push"), true);
});
