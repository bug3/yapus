import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';
import {
  getCreateLabelRefusal,
} from
  '../../../../../../../../hooks/claude/tyler/git/rules/gh/labels/get-create-label-refusal.ts';

const COMMAND = 'gh pr create';
const EXACT = 'the type, scope and breaking-change labels of `gh pr create` must be exactly ';
const KIND_TAIL = ', as its title says, and no kind label; fix --label';

function argsOf(title: string, ...labels: readonly string[]): GhArguments {
  const word = (text: string) => ({ text, isOpaque: false, canSplit: false });

  return {
    values: new Map([['title', [word(title)]], ['label', labels.map(word)]]),
    flags: new Map(),
    operands: [],
  };
}

function refusalOf(title: string, ...labels: readonly string[]): string | undefined {
  return getCreateLabelRefusal(argsOf(title, ...labels), COMMAND);
}

test('accepts exactly the type and scope labels the title says', () => {
  assert.equal(refusalOf('feat(hooks): add', 'type: feat', 'scope: hooks'), undefined);
});

test('reads labels joined by commas, trimmed, across repeated options', () => {
  assert.equal(refusalOf('feat(hooks): add', 'type: feat, scope: hooks'), undefined);
  assert.equal(refusalOf('feat(hooks): add', 'type: feat', 'scope: hooks'), undefined);
});

test('wants the breaking-change label when the title has a bang', () => {
  assert.equal(
    refusalOf('feat(hooks)!: add', 'type: feat', 'scope: hooks', 'breaking-change'),
    undefined,
  );
  assert.equal(
    refusalOf('feat(hooks)!: add', 'type: feat', 'scope: hooks'),
    `${ EXACT }\`type: feat\`, \`scope: hooks\`, \`breaking-change\`${ KIND_TAIL }`,
  );
});

test('refuses the breaking-change label when the title has no bang', () => {
  assert.equal(
    refusalOf('feat(hooks): add', 'type: feat', 'scope: hooks', 'breaking-change'),
    `${ EXACT }\`type: feat\`, \`scope: hooks\`${ KIND_TAIL }`,
  );
});

test('refuses a missing, wrong or extra type or scope label', () => {
  const refusal = `${ EXACT }\`type: feat\`, \`scope: hooks\`${ KIND_TAIL }`;

  assert.equal(refusalOf('feat(hooks): add'), refusal);
  assert.equal(refusalOf('feat(hooks): add', 'type: feat'), refusal);
  assert.equal(refusalOf('feat(hooks): add', 'type: fix', 'scope: hooks'), refusal);
  assert.equal(refusalOf('feat(hooks): add', 'type: feat', 'type: fix', 'scope: hooks'), refusal);
});

test('refuses a kind label on a pull request', () => {
  assert.equal(
    refusalOf('feat(hooks): add', 'type: feat', 'scope: hooks', 'kind: bug'),
    `${ EXACT }\`type: feat\`, \`scope: hooks\`${ KIND_TAIL }`,
  );
});

test('refuses a label outside the catalog', () => {
  assert.equal(
    refusalOf('feat(hooks): add', 'type: feat', 'scope: hooks', 'wip'),
    '`gh pr create` names the label "wip", which is not in the label catalog; '
    + 'use a label from hooks/shared/catalogs',
  );
});

test('refuses a label that is not literal', () => {
  const opaque = { text: '$L', isOpaque: true, canSplit: false };
  const args = { ...argsOf('feat(hooks): add'), values: new Map([['label', [opaque]]]) };

  assert.equal(
    getCreateLabelRefusal(args, COMMAND),
    'the label of `gh pr create` is not literal; write the label literally, the gate reads it',
  );
});
