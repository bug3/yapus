import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMessage } from '../../../hooks/shared/format-message.ts';

const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const NEXT_LINE = String.fromCodePoint(0x85);

test('prefixes a detail with yapus and the program name', () => {
  assert.equal(formatMessage('push', 'cannot judge'), 'yapus push: cannot judge');
});

test('writes a character that could break the line as its code point', () => {
  assert.equal(
    formatMessage('push', `a${ LINE_SEPARATOR }b${ NEXT_LINE }c\rd`),
    'yapus push: a<U+2028>b<U+0085>c<U+000D>d',
  );
});
