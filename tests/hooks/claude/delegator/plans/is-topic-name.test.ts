import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTopicName } from '../../../../../hooks/claude/delegator/plans/is-topic-name.ts';

test('accepts letters and digits with a dot, a hyphen or an underscore after the first', () => {
  assert.deepEqual(
    ['yapus-layout', 'plan_v2.1-final', '2026', 'a'].map((name) => isTopicName(name)),
    [true, true, true, true],
  );
});

test('accepts Turkish letters, composed or decomposed', () => {
  assert.deepEqual(
    ['çalışma-ğüşöı', 's\u0327irket'].map((name) => isTopicName(name)),
    [true, true],
  );
});

test('rejects the directory itself, its parent and a hidden name', () => {
  assert.deepEqual(
    ['.', '..', '...', '.hidden'].map((name) => isTopicName(name)),
    [false, false, false, false],
  );
});

test('rejects a first character that is a hyphen, an underscore or a combining mark', () => {
  assert.deepEqual(
    ['-topic', '_topic', '\u0327topic'].map((name) => isTopicName(name)),
    [false, false, false],
  );
});

test('rejects a space, a line break, a comma, a backtick, a brace and a slash', () => {
  const names = ['a plan', 'line\nbreak', 'topic\n', 'a,b', 'tick`', '{path}', 'a/b'];

  assert.deepEqual(
    names.map((name) => isTopicName(name)),
    [false, false, false, false, false, false, false],
  );
});

test('rejects the empty name', () => {
  assert.equal(isTopicName(''), false);
});

test('accepts 64 characters and rejects 65', () => {
  assert.deepEqual(
    [isTopicName('a'.repeat(64)), isTopicName('a'.repeat(65))],
    [true, false],
  );
});
