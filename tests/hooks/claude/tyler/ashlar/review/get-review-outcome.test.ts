import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { HookInput } from '../../../../../../hooks/claude/tyler/ashlar/parse-hook-input.ts';
import {
  getReviewOutcome,
} from '../../../../../../hooks/claude/tyler/ashlar/review/get-review-outcome.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { reviewFixture } from './review-fixture.ts';

const { makeInput, makeContext } = reviewFixture;

test('fails on an unknown event', (t) => {
  const outcome = getReviewOutcome(
    makeInput(makeCommittedRepo(t), 'Stop'),
    makeContext(makeTempDir(t)),
  );

  assert.deepEqual(outcome, {
    kind: 'failure',
    detail: 'unexpected event Stop; fix the hook matcher',
  });
});

test('fails without an agent id', (t) => {
  const input: HookInput = {
    sessionId: 's1',
    cwd: makeCommittedRepo(t),
    event: 'SubagentStart',
    isRetry: false,
  };
  const outcome = getReviewOutcome(input, makeContext(makeTempDir(t)));

  assert.equal(outcome.kind, 'failure');
});

test('hands a SubagentStart to the start module', (t) => {
  const repo = makeCommittedRepo(t);

  getReviewOutcome(makeInput(repo, 'SubagentStart'), makeContext(makeTempDir(t)));

  assert.ok(existsSync(join(repo, '.git', 'ashlar', 's1.diff')));
});

test('hands a SubagentStop to the stop module', (t) => {
  const dataDir = makeTempDir(t);

  getReviewOutcome(makeInput(makeCommittedRepo(t), 'SubagentStop'), makeContext(dataDir));

  assert.ok(existsSync(join(dataDir, 'decisions.jsonl')));
});
