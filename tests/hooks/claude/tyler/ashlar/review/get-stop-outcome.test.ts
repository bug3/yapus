import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getStartOutcome,
} from '../../../../../../hooks/claude/tyler/ashlar/review/get-start-outcome.ts';
import {
  getStopOutcome,
} from '../../../../../../hooks/claude/tyler/ashlar/review/get-stop-outcome.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';
import { reviewFixture } from './review-fixture.ts';

const { makeInput, makeContext, makePlace } = reviewFixture;
const APPROVE = 'DONE\nAPPROVE';
const PASS = { kind: 'pass' };

function start(repo: string, dataDir: string): void {
  getStartOutcome(makeInput(repo, 'SubagentStart'), makePlace(repo), makeContext(dataDir));
}

function stop(cwd: string, dataDir: string, message: string) {
  return getStopOutcome(
    makeInput(cwd, 'SubagentStop', { message }),
    makePlace(cwd),
    makeContext(dataDir),
  );
}

function countLines(path: string): number {
  return readFileSync(path, 'utf8').trim().split('\n').length;
}

test('records an acceptance for an approve with no edit', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  start(repo, dataDir);

  assert.deepEqual(stop(repo, dataDir, APPROVE), PASS);
  assert.equal(countLines(join(dataDir, 'ashlar', 's1.jsonl')), 1);
});

test('records none for an approve after an edit and logs the reason', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  start(repo, dataDir);
  writeFileSync(join(repo, 'a.txt'), 'edited\n');
  stop(repo, dataDir, APPROVE);

  assert.equal(existsSync(join(dataDir, 'ashlar', 's1.jsonl')), false);
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /the working tree changed/u);
});

test('records none for REWORK', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  start(repo, dataDir);
  stop(repo, dataDir, 'DONE\nREWORK 3');

  assert.equal(existsSync(join(dataDir, 'ashlar', 's1.jsonl')), false);
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /not approved/u);
});

test('passes a stop without a start record and records none', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  assert.deepEqual(stop(repo, dataDir, APPROVE), PASS);
  assert.equal(existsSync(join(dataDir, 'ashlar', 's1.jsonl')), false);
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /no start record/u);
});

test('passes a stop outside a repository, records none and logs it', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);

  start(repo, dataDir);

  assert.deepEqual(stop(makeTempDir(t), dataDir, APPROVE), PASS);
  assert.equal(existsSync(join(dataDir, 'ashlar', 's1.jsonl')), false);
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /no repository at stop/u);
});
