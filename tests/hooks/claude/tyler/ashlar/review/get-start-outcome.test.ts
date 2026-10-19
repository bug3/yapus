import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getStartOutcome,
} from '../../../../../../hooks/claude/tyler/ashlar/review/get-start-outcome.ts';
import {
  getReviewPath,
} from '../../../../../../hooks/claude/tyler/ashlar/review/record-review.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { reviewFixture } from './review-fixture.ts';

const { makeInput, makeContext, makePlace } = reviewFixture;
const PASS = { kind: 'pass' };

test('passes a start outside a repository and writes nothing', (t) => {
  const dataDir = makeTempDir(t);
  const cwd = makeTempDir(t);
  const outcome = getStartOutcome(
    makeInput(cwd, 'SubagentStart'),
    makePlace(cwd),
    makeContext(dataDir),
  );

  assert.deepEqual(outcome, PASS);
  assert.equal(existsSync(join(dataDir, 'ashlar')), false);
});

test('writes the review record and the diff file at start', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  writeFileSync(join(repo, 'a.txt'), 'edited\n');

  const outcome = getStartOutcome(
    makeInput(repo, 'SubagentStart'),
    makePlace(repo),
    makeContext(dataDir),
  );

  assert.deepEqual(outcome, PASS);
  assert.ok(existsSync(getReviewPath(dataDir, 's1', 'agent-1')));
  assert.match(readFileSync(join(dataDir, 'ashlar', 's1.diff'), 'utf8'), /^\+edited$/mu);
});
