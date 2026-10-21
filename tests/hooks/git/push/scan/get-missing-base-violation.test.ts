import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getMissingBaseViolation,
} from '../../../../../hooks/git/push/scan/get-missing-base-violation.ts';
import { getGitEnv } from '../../../../helpers/run-git.ts';
import { makeNpmRepo, PASSING_TEST } from '../make-npm-repo.ts';
import { makeRecord, ZEROS } from './make-record.ts';

const ABSENT = '1'.repeat(40);

test('accepts an update whose remote sha the repository has', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);

  assert.equal(getMissingBaseViolation([makeRecord(sha, sha)], makePlace(repository)), undefined);
});

test('refuses an update whose remote sha the repository lacks, and says to fetch', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);

  assert.equal(
    getMissingBaseViolation([makeRecord(sha, ABSENT)], makePlace(repository)),
    'refs/heads/x is at 111111111111, which this repository does not have;'
    + ' fetch first, then push',
  );
});

test('checks no base for a new ref or a deletion', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);
  const records = [makeRecord(sha, ZEROS, 'refs/heads/n'), makeRecord(ZEROS, ABSENT)];

  assert.equal(getMissingBaseViolation(records, makePlace(repository)), undefined);
});

function makePlace(repository: string) {
  return { cwd: repository, env: getGitEnv(process.env), deadline: Date.now() + 30000 };
}
