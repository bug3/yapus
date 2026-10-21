import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getAttachRefusal,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/scan/get-attach-refusal.ts';

function callOf(tool: 'git' | 'gh', texts: readonly string[]): Call {
  const words = texts.map((text) => ({ text, isOpaque: false, canSplit: false }));

  return { tool, words, configs: [], assignments: [] };
}

function refusalOf(...texts: readonly string[]): string | undefined {
  return getAttachRefusal(callOf('gh', texts));
}

test('refuses an attachment on a comment', () => {
  assert.equal(
    refusalOf('pr', 'comment', '13', '--attach', './login.png'),
    '`gh pr comment --attach` uploads a file the gate cannot read; a person attaches it',
  );
  assert.equal(
    refusalOf('issue', 'comment', '12', '--attach=./a.png#alt'),
    '`gh issue comment --attach` uploads a file the gate cannot read; a person attaches it',
  );
});

test('refuses an attachment on a create and an edit', () => {
  assert.equal(
    refusalOf('pr', 'create', '--attach', './a.png'),
    '`gh pr create --attach` uploads a file the gate cannot read; a person attaches it',
  );
  assert.match(refusalOf('issue', 'new', '--attach=a.png') ?? '', /^`gh issue create --attach`/u);
  assert.match(refusalOf('pr', 'edit', '--attach', 'a.png') ?? '', /^`gh pr edit --attach`/u);
  assert.match(refusalOf('issue', 'edit', '--attach', 'a.png') ?? '', /^`gh issue edit --attach`/u);
});

test('passes a call without an attachment', () => {
  assert.equal(refusalOf('pr', 'comment', '13', '--body', 'Hi'), undefined);
  assert.equal(refusalOf('pr', 'review', '-b', 'Hi'), undefined);
});

test('judges neither an action without the option nor git', () => {
  assert.equal(refusalOf('pr', 'merge', '--attach', 'a'), undefined);
  assert.equal(getAttachRefusal(callOf('git', ['pr', 'comment', '--attach', 'a'])), undefined);
});
