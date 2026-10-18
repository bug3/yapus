import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getThreshold } from '../../../../../hooks/claude/tyler/ashlar/get-threshold.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('gives 150 when the person wrote no file', (t) => {
  assert.deepEqual(getThreshold(makeTempDir(t)), { kind: 'threshold', lines: 150 });
});

test('takes the number the person wrote', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'review-threshold'), '300\n');

  assert.deepEqual(getThreshold(dataDir), { kind: 'threshold', lines: 300 });
});

test('fails naming the path for a file that holds no number', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'review-threshold'), 'abc');

  assert.deepEqual(getThreshold(dataDir), {
    kind: 'failure',
    reason: `${ join(dataDir, 'review-threshold') } holds no whole number; `
      + 'the person writes one there, such as 150',
  });
});

test('fails for an empty file', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'review-threshold'), '');

  assert.equal(getThreshold(dataDir).kind, 'failure');
});
