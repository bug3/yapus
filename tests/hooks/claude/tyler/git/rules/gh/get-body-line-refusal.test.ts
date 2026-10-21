import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getBodyLineRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-body-line-refusal.ts';
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
  return { kind: 'command', words: words(...texts), heredocs: [] };
}

function callOf(...texts: readonly string[]): Call {
  return { tool: 'gh', words: words(...texts), configs: [], assignments: [] };
}

test('passes a call that is the one command of its line', () => {
  const items = [commandItem(...CREATE)];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), undefined);
});

test('refuses a call followed by another command', () => {
  const items = [commandItem(...CREATE), commandItem('cat')];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('refuses a line whose last words are not the call\'s', () => {
  const items = [commandItem('echo', 'pr', 'create', '-F', '/tmp/other.md')];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('passes a call run through a wrapper that is the one command of its line', () => {
  const items = [commandItem('env', ...CREATE)];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), undefined);
});

test('refuses a call that shares its line with another command', () => {
  const items = [commandItem('cat'), commandItem(...CREATE)];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('refuses a line that holds no command item', () => {
  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), [{ kind: 'open' }]), REFUSAL);
});

test('refuses a call inside a subshell', () => {
  const items: Item[] = [{ kind: 'open' }, commandItem(...CREATE), { kind: 'close' }];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('refuses a call read out of a string another command runs', () => {
  const items = [commandItem('bash', '-c', 'cat > f; gh pr create -F /tmp/b.md')];

  assert.equal(getBodyLineRefusal(callOf(...CREATE.slice(1)), items), REFUSAL);
});

test('names the action by its catalog spelling', () => {
  const items = [commandItem('cat'), commandItem('gh', 'pr', 'new', '-F', '/tmp/b.md')];

  assert.equal(getBodyLineRefusal(callOf('pr', 'new', '-F', '/tmp/b.md'), items), REFUSAL);
});

test('passes a call that reads no body file, whatever its line holds', () => {
  const items = [commandItem('cat'), commandItem('gh', 'pr', 'edit', '7')];

  assert.equal(getBodyLineRefusal(callOf('pr', 'edit', '7'), items), undefined);
  assert.equal(getBodyLineRefusal(callOf('pr', 'list'), items), undefined);
});

test('passes a git call', () => {
  const git: Call = { ...callOf('pr', 'create', '-F', 'x'), tool: 'git' };

  assert.equal(getBodyLineRefusal(git, [commandItem('cat'), commandItem('git')]), undefined);
});
