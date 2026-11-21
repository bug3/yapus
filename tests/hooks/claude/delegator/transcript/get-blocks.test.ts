import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBlocks } from '../../../../../hooks/claude/delegator/transcript/get-blocks.ts';

test('gives the blocks of the content of a message, in order', () => {
  const line = {
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'done' },
        { type: 'tool_use', id: 't1', name: 'Bash' },
      ],
    },
  };

  assert.deepEqual(getBlocks(line), [
    { type: 'text', text: 'done' },
    { type: 'tool_use', id: 't1', name: 'Bash' },
  ]);
});

test('gives the blocks of a line of any type', () => {
  const line = {
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] },
  };

  assert.deepEqual(getBlocks(line), [{ type: 'tool_result', tool_use_id: 't1' }]);
});

test('leaves out a content entry that is not an object', () => {
  const line = { message: { content: ['text', 7, ['nested'], { type: 'text' }] } };

  assert.deepEqual(getBlocks(line), [{ type: 'text' }]);
});

test('gives no block for a line without a message', () => {
  assert.deepEqual(getBlocks({ type: 'user' }), []);
});

test('gives no block for a message that is not an object', () => {
  assert.deepEqual(getBlocks({ message: 'text' }), []);
});

test('gives no block for a message without a content list', () => {
  assert.deepEqual(getBlocks({ message: { id: 'm1' } }), []);
});

test('gives no block for a content that is a text', () => {
  assert.deepEqual(getBlocks({ message: { content: 'done' } }), []);
});
