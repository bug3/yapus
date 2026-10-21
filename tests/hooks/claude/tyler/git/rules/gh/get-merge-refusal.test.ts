import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getBodyLineRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-body-line-refusal.ts';
import {
  getMergeRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-merge-refusal.ts';
import type { Item } from '../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function ghCall(...texts: readonly string[]): Call {
  return {
    tool: 'gh',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function refusalOf(...texts: readonly string[]): string | undefined {
  return getMergeRefusal(ghCall(...texts));
}

test('accepts a merge commit that deletes the branch', () => {
  assert.equal(refusalOf('pr', 'merge', '--merge', '--delete-branch'), undefined);
  assert.equal(refusalOf('pr', 'merge', '12', '-m', '-d', '-R', 'o/r'), undefined);
});

test('counts a short group', () => {
  assert.equal(refusalOf('pr', 'merge', '-md'), undefined);
  assert.equal(
    refusalOf('pr', 'merge', '-ms'),
    '`gh pr merge --squash` is not a plain merge; use --merge and --delete-branch only',
  );
});

test('refuses a merge without --merge or without --delete-branch', () => {
  assert.equal(refusalOf('pr', 'merge', '-d'), '`gh pr merge` needs --merge; write it');
  assert.equal(
    refusalOf('pr', 'merge', '--merge'),
    '`gh pr merge` needs --delete-branch; write it',
  );
  assert.equal(
    refusalOf('pr', 'merge', '--merge=false', '-d'),
    '`gh pr merge` needs --merge; write it',
  );
});

test('refuses the flags that change the merge', () => {
  const call = ['pr', 'merge', '-m', '-d'];

  assert.equal(
    refusalOf(...call, '--admin'),
    '`gh pr merge --admin` is not a plain merge; use --merge and --delete-branch only',
  );
  assert.equal(
    refusalOf(...call, '--squash'),
    '`gh pr merge --squash` is not a plain merge; use --merge and --delete-branch only',
  );
  assert.equal(
    refusalOf(...call, '--rebase'),
    '`gh pr merge --rebase` is not a plain merge; use --merge and --delete-branch only',
  );
  assert.equal(
    refusalOf(...call, '--auto'),
    '`gh pr merge --auto` is not a plain merge; use --merge and --delete-branch only',
  );
  assert.equal(
    refusalOf(...call, '--disable-auto'),
    '`gh pr merge --disable-auto` is not a plain merge; use --merge and --delete-branch only',
  );
});

test('passes a flag written as false', () => {
  assert.equal(refusalOf('pr', 'merge', '-m', '-d', '--admin=false'), undefined);
});

test('refuses an option the gate does not know', () => {
  assert.equal(
    refusalOf('pr', 'merge', '-m', '-d', '--x'),
    '`gh pr merge --x` is not an option the gate knows; a person runs it',
  );
});

test('refuses an argument the shell may split', () => {
  const call = ghCall('pr', 'merge', '-m', '-d');
  const word = { text: '$N', isOpaque: true, canSplit: true };

  assert.match(
    getMergeRefusal({ ...call, words: [...call.words, word] }) ?? '',
    /^cannot judge `gh pr merge`/,
  );
});

test('passes other gh actions and git calls', () => {
  assert.equal(refusalOf('pr', 'view', '--admin'), undefined);
  assert.equal(getMergeRefusal({ ...ghCall('pr', 'merge'), tool: 'git' }), undefined);
});

test('reads the body file of a merge only from a line of its own', () => {
  const merge = ['gh', 'pr', 'merge', '-m', '-d', '-F', '/tmp/b.md'];
  const item = (...texts: readonly string[]): Item => ({
    kind: 'command',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    heredocs: [],
    hasRedirection: false,
  });

  assert.equal(getBodyLineRefusal(ghCall(...merge.slice(1)), [item(...merge)]), undefined);
  assert.equal(
    getBodyLineRefusal(ghCall(...merge.slice(1)), [item(...merge), item('cat')]),
    'run `gh pr merge` on a line of its own, after the body file is written; '
    + 'the gate reads the body file before the line runs',
  );
});
