import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getScanRanges } from '../../../../../hooks/git/push/scan/get-scan-ranges.ts';
import { runGit } from '../../../../helpers/run-git.ts';
import { makeRecord, ZEROS } from './make-record.ts';
import { makeTwoCommits } from './make-two-commits.ts';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('gives an update the commits after the remote sha up to the local sha', () => {
  assert.deepEqual(getScanRanges([makeRecord(B, A)], 'origin'), [`^${ A }`, B]);
});

test('gives a new ref its commits that the target remote lacks', () => {
  assert.deepEqual(
    getScanRanges([makeRecord(B, ZEROS)], 'origin'),
    [B, '--not', '--remotes=origin/*'],
  );
});

test('puts the updates before the new refs and the exclusion last', () => {
  const records = [makeRecord(C, ZEROS, 'refs/heads/new'), makeRecord(B, A)];

  assert.deepEqual(
    getScanRanges(records, 'origin'),
    [`^${ A }`, B, C, '--not', '--remotes=origin/*'],
  );
});

test('gives a deletion nothing to scan', () => {
  assert.deepEqual(getScanRanges([makeRecord(ZEROS, A)], 'origin'), []);
});

test('excludes nothing for a new ref pushed to a URL', () => {
  assert.deepEqual(getScanRanges([makeRecord(B, ZEROS)], 'https://example.invalid/r.git'), [B]);
});

test('excludes nothing for a remote text that holds two dots in a row', () => {
  assert.deepEqual(getScanRanges([makeRecord(B, ZEROS)], '../elsewhere'), [B]);
});

test('still lists a new ref commit that only another remote has', (t) => {
  const { repository, second } = makeTwoCommits(t);

  runGit(['update-ref', 'refs/remotes/other/main', second], repository);
  const ranges = getScanRanges([makeRecord(second, ZEROS)], 'origin');

  assert.equal(runGit(['rev-list', ...ranges], repository).includes(second), true);
});

test('leaves out a new ref commit that the target remote has', (t) => {
  const { repository, second } = makeTwoCommits(t);

  runGit(['update-ref', 'refs/remotes/origin/main', second], repository);
  const ranges = getScanRanges([makeRecord(second, ZEROS)], 'origin');

  assert.equal(runGit(['rev-list', ...ranges], repository), '');
});

test('lists the whole history of a new ref pushed to a URL', (t) => {
  const { repository, first, second } = makeTwoCommits(t);

  runGit(['update-ref', 'refs/remotes/origin/main', second], repository);
  const ranges = getScanRanges([makeRecord(second, ZEROS)], 'https://example.invalid/r.git');

  assert.equal(runGit(['rev-list', ...ranges], repository), `${ second }\n${ first }\n`);
});
