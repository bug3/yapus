import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMessage } from '../../../hooks/m6/format-message.ts';

test('prefixes a detail with the program name', () => {
  assert.equal(formatMessage('cannot judge'), 'yapus m6: cannot judge');
});
