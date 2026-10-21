import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getMisplacedOptionRefusal,
} from
  '../../../../../../../hooks/claude/tyler/git/rules/gh/get-misplaced-option-refusal.ts';

function callOf(tool: 'git' | 'gh', ...words: readonly string[]): Call {
  return {
    tool,
    words: words.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function refusalOf(...words: readonly string[]): string | undefined {
  return getMisplacedOptionRefusal(callOf('gh', ...words));
}

test('refuses an option between the command and its action', () => {
  const reason = 'the word after `gh pr` is an option or cannot be read, so the gate cannot '
    + 'tell the action; put gh options after `gh pr <action>`';

  assert.equal(refusalOf('pr', '-R', 'o/r', 'create'), reason);
  assert.equal(refusalOf('pr', '--repo=o/r', 'create'), reason);
});

test('refuses it for every command that has subcommands', () => {
  assert.match(refusalOf('issue', '-R', 'o/r', 'create') ?? '', /`gh issue`/);
  assert.match(refusalOf('label', '--repo', 'o/r', 'create') ?? '', /`gh label`/);
  assert.match(refusalOf('repo', '-R', 'x', 'delete', 'y') ?? '', /`gh repo`/);
});

test('refuses a word the shell expands where the action should be', () => {
  const call = callOf('gh', 'pr');
  const action = { text: '$A', isOpaque: true, canSplit: false };

  assert.match(
    getMisplacedOptionRefusal({ ...call, words: [...call.words, action] }) ?? '',
    /^the word after `gh pr`/,
  );
});

test('passes an action, a command alone, and a command with no actions', () => {
  assert.equal(refusalOf('pr', 'create', '-R', 'o/r'), undefined);
  assert.equal(refusalOf('pr'), undefined);
  assert.equal(refusalOf('api', '-H', 'x', '/user'), undefined);
  assert.equal(refusalOf('browse', '-n'), undefined);
  assert.equal(refusalOf('status'), undefined);
  assert.equal(refusalOf('copilot', '-p', 'x'), undefined);
});

test('passes a git call', () => {
  assert.equal(getMisplacedOptionRefusal(callOf('git', 'pr', '-R')), undefined);
});
