import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readReview } from '../../../../../../hooks/claude/tyler/ashlar/review/read-review.ts';
import {
  getReviewPath,
  recordReview,
} from '../../../../../../hooks/claude/tyler/ashlar/review/record-review.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

test('reads back what it recorded', (t) => {
  const path = getReviewPath(makeTempDir(t), 's1', 'agent-1');

  recordReview(path, { base: 'aaa', tree: 'bbb' });

  assert.deepEqual(readReview(path), { base: 'aaa', tree: 'bbb' });
});

test('gives undefined for a missing file', (t) => {
  assert.equal(readReview(join(makeTempDir(t), 'none.review')), undefined);
});

test('gives undefined for a file that is not a review', (t) => {
  const path = join(makeTempDir(t), 'bad.review');

  writeFileSync(path, 'garbage');

  assert.equal(readReview(path), undefined);
});

test('gives two agent ids two paths', () => {
  assert.notEqual(getReviewPath('/d', 's1', 'agent-1'), getReviewPath('/d', 's1', 'agent-2'));
});
