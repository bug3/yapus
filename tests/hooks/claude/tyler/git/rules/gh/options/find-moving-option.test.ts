import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  findMovingOption,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/options/find-moving-option.ts';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';

const CALL: Call = { tool: 'gh', words: [], configs: [], assignments: [] };
const WORD = { text: 'o/r', isOpaque: false, canSplit: false };

function argsOf(...options: readonly string[]): GhArguments {
  return {
    values: new Map(options.map((option) => [option, [WORD]])),
    flags: new Map(),
    operands: [],
  };
}

test('names a listed option the call gives a value', () => {
  assert.equal(findMovingOption(CALL, argsOf('repo'), ['repo', 'head']), '--repo');
  assert.equal(findMovingOption(CALL, argsOf('head'), ['repo', 'head']), '--head');
});

test('ignores an option the action does not list', () => {
  assert.equal(findMovingOption(CALL, argsOf('head'), ['repo']), undefined);
});

test('names a GH_REPO assignment', () => {
  const call = { ...CALL, assignments: ['GH_REPO'] };

  assert.equal(findMovingOption(call, argsOf(), ['repo']), 'GH_REPO');
});

test('names an assignment that is not GH_REPO', () => {
  const call = { ...CALL, assignments: ['GIT_DIR'] };

  assert.equal(findMovingOption(call, argsOf(), ['repo']), 'GIT_DIR');
});

test('names an operand that is a URL', () => {
  const url = { ...WORD, text: 'https://github.com/o/r/pull/5' };
  const args = { ...argsOf(), operands: [url] };

  assert.equal(findMovingOption(CALL, args, ['repo']), url.text);
});

test('passes an operand that is a number', () => {
  const args = { ...argsOf(), operands: [{ ...WORD, text: '5' }] };

  assert.equal(findMovingOption(CALL, args, ['repo']), undefined);
});

test('passes a call that names no other repository', () => {
  assert.equal(findMovingOption(CALL, argsOf(), ['repo', 'head']), undefined);
});
