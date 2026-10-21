import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getOwnLineRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-own-line-refusal.ts';
import type {
  Item,
  Word,
} from '../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

const REFUSAL = 'run `gh pr create` on a line of its own, after the body file is written; '
  + 'the gate reads the body file before the line runs';
const CREATE = ['gh', 'pr', 'create', '-F', '/tmp/b.md'];

function words(...texts: readonly string[]): Word[] {
  return texts.map((text) => ({ text, isOpaque: false, canSplit: false }));
}

function commandItem(...texts: readonly string[]): Item {
  return { kind: 'command', words: words(...texts), heredocs: [], hasRedirection: false };
}

function callOf(...texts: readonly string[]): Call {
  return { tool: 'gh', words: words(...texts), configs: [], assignments: [] };
}

test('passes a call that is the one command of its line', () => {
  const items = [commandItem(...CREATE)];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), undefined);
});

test('refuses a call followed by another command', () => {
  const items = [commandItem(...CREATE), commandItem('cat')];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('passes gh written as a path', () => {
  const items = [commandItem('/usr/local/bin/gh', ...CREATE.slice(1))];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), undefined);
});

test('refuses a line whose command is not gh itself', () => {
  const items = [commandItem('echo', 'pr', 'create', '-F', '/tmp/other.md')];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), [commandItem('ghx')]), REFUSAL);
});

test('refuses a call run through a wrapper', () => {
  const items = [commandItem('env', 'X=1', ...CREATE)];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('refuses a command word the shell expands', () => {
  const program = { text: '$GH', isOpaque: true, canSplit: false };
  const item: Item = {
    kind: 'command',
    words: [program, ...words(...CREATE.slice(1))],
    heredocs: [],
    hasRedirection: false,
  };

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), [item]), REFUSAL);
});

test('refuses a call whose command has a redirection', () => {
  const item: Item = {
    kind: 'command',
    words: words(...CREATE),
    heredocs: [],
    hasRedirection: true,
  };

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), [item]), REFUSAL);
});

test('refuses a call that shares its line with another command', () => {
  const items = [commandItem('cat'), commandItem(...CREATE)];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('refuses a line that holds no command item', () => {
  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), [{ kind: 'open' }]), REFUSAL);
});

test('refuses a call inside a subshell', () => {
  const items: Item[] = [{ kind: 'open' }, commandItem(...CREATE), { kind: 'close' }];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('refuses a call read out of a string another command runs', () => {
  const items = [commandItem('bash', '-c', 'cat > f; gh pr create -F /tmp/b.md')];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('names the action by its catalog spelling', () => {
  const items = [commandItem('cat'), commandItem('gh', 'pr', 'new', '-F', '/tmp/b.md')];

  assert.equal(getOwnLineRefusal(callOf('pr', 'new', '-F', '/tmp/b.md'), items), REFUSAL);
});

test('passes a call that reads no body file, whatever its line holds', () => {
  const items = [commandItem('cat'), commandItem('gh', 'pr', 'edit', '7')];

  assert.equal(getOwnLineRefusal(callOf('pr', 'edit', '7'), items), undefined);
  assert.equal(getOwnLineRefusal(callOf('pr', 'list'), items), undefined);
});

test('passes a git call', () => {
  const git: Call = { ...callOf('pr', 'create', '-F', 'x'), tool: 'git' };

  assert.equal(getOwnLineRefusal(git, [commandItem('cat'), commandItem('git')]), undefined);
});

const MERGE_REFUSAL = 'run `gh pr merge` on a line of its own; the gate judges it against the '
  + 'directory and repository the line starts in';

test('refuses a merge that shares its line, though it reads no body file', () => {
  const merge = ['pr', 'merge', '3', '-m', '-d'];
  const items = [commandItem('cd', '/other'), commandItem('gh', ...merge)];

  assert.equal(getOwnLineRefusal(callOf(...merge), items), MERGE_REFUSAL);
});

test('passes a merge that is the one command of its line', () => {
  const merge = ['pr', 'merge', '3', '-m', '-d'];

  assert.equal(getOwnLineRefusal(callOf(...merge), [commandItem('gh', ...merge)]), undefined);
});

test('refuses a create that shares its line, with the body file reason', () => {
  const items = [commandItem('cat'), commandItem(...CREATE)];

  assert.equal(getOwnLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});
