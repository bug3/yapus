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
import { runGit } from '../../../../../helpers/run-git.ts';
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
  assert.match(readFileSync(join(repo, '.git', 'ashlar', 's1.diff'), 'utf8'), /^\+edited$/mu);
});

test('logs the fall back to HEAD once when the session has no start', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);
  const input = makeInput(repo, 'SubagentStart');

  getStartOutcome(input, makePlace(repo), makeContext(dataDir));
  getStartOutcome(input, makePlace(repo), makeContext(dataDir));

  assert.deepEqual(readLog(dataDir), [{
    time: '2026-10-19T10:00:00Z',
    hook: 'ashlar review',
    sessionId: 's1',
    subject: runGit(['rev-parse', 'HEAD^{tree}'], repo).trim(),
    allowed: true,
    reason: 'base fell back to HEAD now',
  }]);
});

function readLog(dataDir: string): readonly unknown[] {
  const lines = readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8').trim().split('\n');

  return lines.map((line): unknown => JSON.parse(line));
}
