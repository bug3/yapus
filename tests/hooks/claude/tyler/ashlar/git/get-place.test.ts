import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getPlace } from '../../../../../../hooks/claude/tyler/ashlar/git/get-place.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

const NO_DEADLINE = Number.POSITIVE_INFINITY;

test('drops a GIT_DIR that would tie git to another repository', (t) => {
  const repo = makeCommittedRepo(t);
  const place = getPlace(repo, { ...process.env, GIT_DIR: join(repo, 'nowhere') }, NO_DEADLINE);

  assert.ok(!('kind' in place), JSON.stringify(place));
  assert.equal(place.env.GIT_DIR, undefined);
});

test('gives a place with the installed git', (t) => {
  const dir = makeTempDir(t);

  const place = getPlace(dir, process.env, NO_DEADLINE);

  assert.equal('kind' in place, false, JSON.stringify(place));
});

test('gives no git with the install instruction when git does not start', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(getPlace(dir, { ...process.env, PATH: '' }, NO_DEADLINE), {
    kind: 'no git',
    detail: 'git not found; install git',
  });
});
