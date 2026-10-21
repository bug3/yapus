import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';
import {
  getEditLabelRefusal,
} from
  '../../../../../../../../hooks/claude/tyler/git/rules/gh/labels/get-edit-label-refusal.ts';

const COMMAND = 'gh pr edit';

function argsOf(added: readonly string[], removed: readonly string[]): GhArguments {
  const word = (text: string) => ({ text, isOpaque: false, canSplit: false });

  return {
    values: new Map([['add-label', added.map(word)], ['remove-label', removed.map(word)]]),
    flags: new Map(),
    operands: [],
  };
}

function refusalOf(added: readonly string[], removed: readonly string[]): string | undefined {
  return getEditLabelRefusal(argsOf(added, removed), COMMAND);
}

test('accepts adding catalog labels and removing a kind label', () => {
  assert.equal(refusalOf(['type: feat', 'kind: bug'], ['kind: other']), undefined);
});

test('refuses adding a label outside the catalog', () => {
  assert.equal(
    refusalOf(['wip'], []),
    '`gh pr edit` names the label "wip", which is not in the label catalog; '
    + 'use a label from hooks/shared/catalogs',
  );
});

test('refuses removing a type, scope or breaking-change label', () => {
  const reason = (label: string): string =>
    `\`gh pr edit --remove-label\` cannot remove "${ label }", which the title says; `
    + 'change the title instead';

  assert.equal(refusalOf([], ['type: feat']), reason('type: feat'));
  assert.equal(refusalOf([], ['scope: hooks']), reason('scope: hooks'));
  assert.equal(refusalOf([], ['breaking-change']), reason('breaking-change'));
});

test('refuses a removed label that is not literal', () => {
  const opaque = { text: '$L', isOpaque: true, canSplit: false };
  const args = { ...argsOf([], []), values: new Map([['remove-label', [opaque]]]) };

  assert.equal(
    getEditLabelRefusal(args, COMMAND),
    'the remove label of `gh pr edit` is not literal; write the remove label literally, '
    + 'the gate reads it',
  );
});
