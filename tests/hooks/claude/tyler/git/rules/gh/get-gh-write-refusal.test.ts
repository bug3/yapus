import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getGhWriteRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/get-gh-write-refusal.ts';
import type { Word } from '../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

const METHOD = '`gh api` with a method other than GET writes on GitHub; a person runs it';
const FIELDS = '`gh api` with a field or input option and no method posts; '
  + 'add -X GET to read, or a person runs it';
const GRAPHQL = '`gh api graphql` posts every query and mutation; a person runs it';
const EXPANSION = '`gh api` has an argument that starts with an expansion, which could be a '
  + 'method or a field; write it literally';
const UNREADABLE = 'cannot judge `gh api` with an argument the gate cannot read; '
  + 'quote it if it is one word, and start it with neither - nor +';

function word(text: string, flags: Partial<Word> = {}): Word {
  return { text, isOpaque: false, canSplit: false, ...flags };
}

function callOf(tool: 'git' | 'gh', words: readonly Word[]): Call {
  return { tool, words, configs: [], assignments: [] };
}

function refusalOf(...texts: readonly string[]): string | undefined {
  return getGhWriteRefusal(callOf('gh', texts.map((text) => word(text))));
}

test('passes a read through gh api', () => {
  assert.equal(refusalOf('api', 'repos/o/r/pulls'), undefined);
  assert.equal(refusalOf('api', '-H', 'Accept: x', '--paginate', '/user'), undefined);
  assert.equal(refusalOf('api', '-X', 'GET', '/user'), undefined);
  assert.equal(refusalOf('api', '--jq', '.login', '--include', '/user'), undefined);
});

test('passes a get method in any spelling and any case', () => {
  assert.equal(refusalOf('api', '-XGET', '/user'), undefined);
  assert.equal(refusalOf('api', '--method=get', '/user'), undefined);
  assert.equal(refusalOf('api', '--method', 'Get', '/user'), undefined);
});

test('passes fields once the method is GET', () => {
  assert.equal(refusalOf('api', '-X', 'GET', '-f', 'q=x', '/search'), undefined);
  assert.equal(refusalOf('api', '--method=GET', '--field=k=v', '/search'), undefined);
});

test('passes a quoted endpoint with a literal start', () => {
  assert.equal(getGhWriteRefusal(callOf('gh', [
    word('api'),
    word('repos/o/$R', { isOpaque: true }),
  ])), undefined);
});

test('refuses a method that is not GET', () => {
  assert.equal(refusalOf('api', '-X', 'POST', '/x'), METHOD);
  assert.equal(refusalOf('api', '-XPATCH', '/x'), METHOD);
  assert.equal(refusalOf('api', '--method', 'put', '/x'), METHOD);
  assert.equal(refusalOf('api', '--method=post', '/x'), METHOD);
  assert.equal(refusalOf('api', '-iXDELETE', '/x'), METHOD);
});

test('refuses a method the gate cannot read', () => {
  assert.equal(getGhWriteRefusal(callOf('gh', [
    word('api'),
    word('-X'),
    word('M', { isOpaque: true }),
  ])), METHOD);
});

test('refuses a field or input option when no method is given', () => {
  assert.equal(refusalOf('api', '/x', '-f', 'k=v'), FIELDS);
  assert.equal(refusalOf('api', '/x', '-F', 'k=@file'), FIELDS);
  assert.equal(refusalOf('api', '/x', '-fk=v'), FIELDS);
  assert.equal(refusalOf('api', '/x', '-if', 'k=v'), FIELDS);
  assert.equal(refusalOf('api', '/x', '--field', 'k=v'), FIELDS);
  assert.equal(refusalOf('api', '/x', '--field=k=v'), FIELDS);
  assert.equal(refusalOf('api', '/x', '--raw-field', 'k=v'), FIELDS);
  assert.equal(refusalOf('api', '/x', '--input', 'body.json'), FIELDS);
  assert.equal(refusalOf('api', '/x', '--input=body.json'), FIELDS);
});

test('refuses a field when a later method is not GET', () => {
  assert.equal(refusalOf('api', '-f', 'k=v', '-X', 'POST', '/x'), METHOD);
});

test('refuses graphql whatever else is written', () => {
  assert.equal(refusalOf('api', 'graphql', '-f', 'query=x'), GRAPHQL);
  assert.equal(refusalOf('api', '-X', 'GET', 'graphql'), GRAPHQL);
  assert.equal(refusalOf('api', '--hostname', 'h', 'graphql'), GRAPHQL);
});

test('refuses a word the shell may split', () => {
  assert.equal(getGhWriteRefusal(callOf('gh', [
    word('api'),
    word('$ARGS', { isOpaque: true, canSplit: true }),
  ])), UNREADABLE);
});

test('refuses an operand that starts with an expansion', () => {
  assert.equal(getGhWriteRefusal(callOf('gh', [
    word('api'),
    word('$URL', { isOpaque: true }),
  ])), EXPANSION);
  assert.equal(getGhWriteRefusal(callOf('gh', [
    word('api'),
    word('`pwd`', { isOpaque: true }),
  ])), EXPANSION);
});

test('refuses every gh label change', () => {
  assert.equal(
    refusalOf('label', 'create', 'x'),
    '`gh label create` changes labels outside the catalog; '
    + 'run `node hooks/shared/labels/sync-labels.ts` instead',
  );
  assert.equal(
    refusalOf('label', 'edit', 'x'),
    '`gh label edit` changes labels outside the catalog; '
    + 'run `node hooks/shared/labels/sync-labels.ts` instead',
  );
  assert.equal(
    refusalOf('label', 'delete', 'x'),
    '`gh label delete` changes labels outside the catalog; '
    + 'run `node hooks/shared/labels/sync-labels.ts` instead',
  );
  assert.equal(
    refusalOf('label', 'clone', 'x'),
    '`gh label clone` changes labels outside the catalog; '
    + 'run `node hooks/shared/labels/sync-labels.ts` instead',
  );
});

test('passes label list and other gh commands', () => {
  assert.equal(refusalOf('label', 'list'), undefined);
  assert.equal(refusalOf('label'), undefined);
  assert.equal(refusalOf('pr', 'create', '-f'), undefined);
  assert.equal(refusalOf('repo', 'view'), undefined);
});

test('passes a git call', () => {
  const call = callOf('git', [word('api'), word('-X'), word('POST')]);

  assert.equal(getGhWriteRefusal(call), undefined);
});
