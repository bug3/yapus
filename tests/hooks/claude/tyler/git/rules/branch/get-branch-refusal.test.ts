import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getBranchRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/branch/get-branch-refusal.ts';

const NAME_REFUSAL = /^branch `wip` is not `<type>\/<slug>` \(type from \S+types\.json, slug of lowercase letters, digits and hyphens, at most 50\); name it so$/;

function gitCall(...texts: readonly string[]): Call {
  return {
    tool: 'git',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function withQuoted(call: Call): Call {
  return { ...call, words: [...call.words, { text: '$B', isOpaque: true, canSplit: false }] };
}

function refusalOf(...texts: readonly string[]): string {
  return getBranchRefusal(gitCall(...texts)) ?? '';
}

test('refuses a badly named branch from each creating command', () => {
  assert.match(refusalOf('checkout', '-b', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('checkout', '-B', 'wip', 'main'), NAME_REFUSAL);
  assert.match(refusalOf('switch', '-c', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('switch', '--create', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('switch', '--cre=wip'), NAME_REFUSAL);
  assert.match(refusalOf('worktree', 'add', '-b', 'wip', '../x'), NAME_REFUSAL);
  assert.match(refusalOf('branch', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('branch', '-m', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('branch', '-M', 'feat/a', 'wip'), NAME_REFUSAL);
});

test('reads git branch options cut to a prefix and listing options as no mode', () => {
  assert.match(refusalOf('branch', '--mov', 'feat/a', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('branch', '--sort=refname', 'wip'), NAME_REFUSAL);
  assert.match(refusalOf('branch', '--format=x', 'wip'), NAME_REFUSAL);
  assert.equal(getBranchRefusal(gitCall('branch', '--del', 'wip')), undefined);
});

test('refuses a word the shell may split in a creating command', () => {
  const splittable = { text: '$X', isOpaque: true, canSplit: true };
  const reason = 'cannot judge `git switch` with an argument the gate cannot read; '
    + 'quote it if it is one word, and start it with neither - nor +';

  assert.equal(
    getBranchRefusal({ ...gitCall('switch'), words: [...gitCall('switch').words, splittable] }),
    reason,
  );
});

test('reads an attached value and a value after a short group', () => {
  assert.match(refusalOf('checkout', '-bwip'), NAME_REFUSAL);
  assert.match(refusalOf('checkout', '-qb', 'wip'), NAME_REFUSAL);
});

test('passes a well named branch from each creating command', () => {
  assert.equal(getBranchRefusal(gitCall('checkout', '-b', 'feat/x')), undefined);
  assert.equal(getBranchRefusal(gitCall('switch', '-c', 'fix/y-2')), undefined);
  assert.equal(getBranchRefusal(gitCall('worktree', 'add', '-b', 'docs/z', '../x')), undefined);
  assert.equal(getBranchRefusal(gitCall('branch', 'test/a', 'main')), undefined);
});

test('passes main and master, the first branch of a new repository', () => {
  assert.equal(getBranchRefusal(gitCall('checkout', '-b', 'main')), undefined);
  assert.equal(getBranchRefusal(gitCall('branch', '-m', 'master', 'main')), undefined);
});

test('passes commands that create no branch', () => {
  assert.equal(getBranchRefusal(gitCall('checkout', 'wip')), undefined);
  assert.equal(getBranchRefusal(gitCall('switch', 'wip')), undefined);
  assert.equal(getBranchRefusal(gitCall('checkout', '--', 'wip')), undefined);
  assert.equal(getBranchRefusal(gitCall('branch')), undefined);
  assert.equal(getBranchRefusal(gitCall('branch', '-d', 'wip')), undefined);
  assert.equal(getBranchRefusal(gitCall('branch', '--list', 'wip')), undefined);
  assert.equal(getBranchRefusal(gitCall('worktree', 'add', '../x', 'wip')), undefined);
});

test('refuses a branch name the gate cannot read', () => {
  const reason = 'cannot judge `git checkout` with an argument the gate cannot read; '
    + 'quote it if it is one word, and start it with neither - nor +';

  assert.equal(getBranchRefusal(withQuoted(gitCall('checkout', '-b'))), reason);
  assert.equal(getBranchRefusal(gitCall('checkout', '-b')), reason);
});
