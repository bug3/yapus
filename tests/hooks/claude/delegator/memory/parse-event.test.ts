import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEvent } from '../../../../../hooks/claude/delegator/memory/parse-event.ts';

test('reads a gh event as the two words after gh', () => {
  assert.deepEqual(parseEvent('gh pr merge'), { kind: 'gh', group: 'pr', action: 'merge' });
});

test('reads a launch event as its agent type', () => {
  assert.deepEqual(
    parseEvent('launch delegator:finisher'),
    { kind: 'launch', agentType: 'delegator:finisher' },
  );
});

test('keeps the words of an event as they are written', () => {
  assert.deepEqual(
    [parseEvent('gh PR new'), parseEvent('launch Explore')],
    [{ kind: 'gh', group: 'PR', action: 'new' }, { kind: 'launch', agentType: 'Explore' }],
  );
});

test('reads no event from a gh command of one word or of three', () => {
  assert.deepEqual([parseEvent('gh pr'), parseEvent('gh pr merge 5')], [undefined, undefined]);
});

test('reads no event from a launch with no agent type or with two words', () => {
  assert.deepEqual(
    [parseEvent('launch'), parseEvent('launch '), parseEvent('launch a b')],
    [undefined, undefined, undefined],
  );
});

test('reads no event from a text that starts with neither word', () => {
  assert.deepEqual(
    [parseEvent('merge'), parseEvent('git pr merge'), parseEvent('launched a'), parseEvent('')],
    [undefined, undefined, undefined, undefined],
  );
});

test('reads no event from a text with space around it, two spaces or a line break', () => {
  const texts = [' gh pr merge', 'gh pr merge ', 'gh  pr merge', 'gh pr merge\n', 'launch a\nb'];

  assert.deepEqual(
    texts.map((text) => parseEvent(text)),
    [undefined, undefined, undefined, undefined, undefined],
  );
});
