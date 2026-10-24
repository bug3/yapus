import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMedian } from '../../../../../hooks/claude/providens/report/get-median.ts';

test('gives the middle value of an odd count, unsorted', () => {
  assert.equal(getMedian([9, 1, 5]), 5);
});

test('gives the mean of the two middle values of an even count', () => {
  assert.equal(getMedian([4, 1, 3, 2]), 2.5);
});

test('gives undefined for no numbers', () => {
  assert.equal(getMedian([]), undefined);
});
