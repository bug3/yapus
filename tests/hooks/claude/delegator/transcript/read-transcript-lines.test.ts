import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readTranscriptLines,
} from '../../../../../hooks/claude/delegator/transcript/read-transcript-lines.ts';

test('gives the object of each line, in the order of the text', () => {
  const text = '{"type":"user","message":{}}\n{"type":"assistant","timestamp":"t"}';

  assert.deepEqual(readTranscriptLines(text), [
    { type: 'user', message: {} },
    { type: 'assistant', timestamp: 't' },
  ]);
});

test('leaves out a line that does not parse', () => {
  const text = 'not json\n{"type":"user"}\n{"type":"assis';

  assert.deepEqual(readTranscriptLines(text), [{ type: 'user' }]);
});

test('leaves out a line that parses to a list, a number, a text or null', () => {
  const text = '[1,2]\n7\n"text"\nnull\n{"type":"user"}';

  assert.deepEqual(readTranscriptLines(text), [{ type: 'user' }]);
});

test('leaves out the empty line after the last line break', () => {
  assert.deepEqual(readTranscriptLines('{"type":"user"}\n'), [{ type: 'user' }]);
});

test('gives no line for an empty text', () => {
  assert.deepEqual(readTranscriptLines(''), []);
});
