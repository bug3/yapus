import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMessage } from '../../../hooks/dashes/format-message.ts';

test('prefixes a detail with the program name', () => {
  assert.equal(formatMessage('cannot judge'), 'yapus dashes: cannot judge');
});
