import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { readPlans } from '../../../../../hooks/claude/delegator/recall/read-plans.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('lists the plan files across months newest first, by path at one time', (t) => {
  const plansDir = makeTempDir(t);
  const old = writePlan(plansDir, '2026-10/old', 1000);
  const newer = writePlan(plansDir, '2026-11/newer', 3000);
  const b = writePlan(plansDir, '2026-11/b', 2000);
  const c = writePlan(plansDir, '2026-10/c', 2000);
  const newest = writePlan(plansDir, '2025-12/newest', 4000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [newest, newer, c, b, old] });
});

test('orders by the time of the plan file, not of a detail file beside it', (t) => {
  const plansDir = makeTempDir(t);
  const a = writePlan(plansDir, '2026-11/a', 1000);
  const b = writePlan(plansDir, '2026-11/b', 2000);

  writeFile(dirname(a), 'S1.md', 9000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [b, a] });
});

test('lists no detail file and no file directly in the plans directory or in a month', (t) => {
  const plansDir = makeTempDir(t);
  const plan = writePlan(plansDir, '2026-11/topic', 1000);

  writeFile(dirname(plan), 'S1.md', 9000);
  writeFile(dirname(plan), 'review-1.md', 9000);
  writeFile(join(dirname(plan), 'deeper'), 'plan.md', 9000);
  writeFile(plansDir, 'topic.md', 9000);
  writeFile(plansDir, 'plan.md', 9000);
  writeFile(join(plansDir, '2026-11'), 'plan.md', 9000);
  writeFile(join(plansDir, '2026-11'), 'notes.md', 9000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [plan] });
});

test('lists no topic without a plan file and no plan.md that is a directory or a link', (t) => {
  const plansDir = makeTempDir(t);
  const plan = writePlan(plansDir, '2026-11/topic', 1000);

  writeFile(join(plansDir, '2026-11', 'detail-only'), 'S1.md', 9000);
  mkdirSync(join(plansDir, '2026-11', 'folder', 'plan.md'), { recursive: true });
  mkdirSync(join(plansDir, '2026-11', 'linked'));
  symlinkSync(plan, join(plansDir, '2026-11', 'linked', 'plan.md'));

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [plan] });
});

test('lists no plan under a name that is not a month', (t) => {
  const plansDir = makeTempDir(t);
  const plan = writePlan(plansDir, '2026-11/topic', 1000);

  writePlan(plansDir, '2026-13/topic', 9000);
  writePlan(plansDir, '2026-00/topic', 9000);
  writePlan(plansDir, '2026-1/topic', 9000);
  writePlan(plansDir, '2026-11-15/topic', 9000);
  writePlan(plansDir, 'backup/topic', 9000);
  writePlan(plansDir, 'topic/topic', 9000);
  writeFile(plansDir, '2026-12', 9000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [plan] });
});

test('lists no plan under a hidden name or one with a space, a newline or punctuation', (t) => {
  const plansDir = makeTempDir(t);
  const plan = writePlan(plansDir, '2026-11/plan_v2-final', 1000);

  writePlan(plansDir, '2026-11/.hidden', 9000);
  writePlan(plansDir, '2026-11/a plan', 9000);
  writePlan(plansDir, '2026-11/line\nbreak', 9000);
  writePlan(plansDir, '2026-11/a, b', 9000);
  writePlan(plansDir, '2026-11/tick`', 9000);
  writePlan(plansDir, '2026-11/{path}', 9000);
  writePlan(plansDir, '2026-11/-topic', 9000);
  writeFile(join(plansDir, '2026-11'), 'file-topic', 9000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [plan] });
});

test('lists no plan under a topic outside the NAME-1 form', (t) => {
  const plansDir = makeTempDir(t);
  const plan = writePlan(plansDir, '2026-11/topic', 1000);

  writePlan(plansDir, '2026-11/API-redesign', 9000);
  writePlan(plansDir, '2026-11/dosya-adlandırma', 9000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [plan] });
});

test('lists a topic of 64 characters and skips one of 65', (t) => {
  const plansDir = makeTempDir(t);
  const plan = writePlan(plansDir, `2026-11/${ 'a'.repeat(64) }`, 1000);

  writePlan(plansDir, `2026-11/${ 'b'.repeat(65) }`, 2000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [plan] });
});

test('lists the five newest plan files of all months', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, '2026-11/p1', 1000);

  const p2 = writePlan(plansDir, '2026-09/p2', 2000);
  const p3 = writePlan(plansDir, '2026-10/p3', 3000);
  const p4 = writePlan(plansDir, '2026-11/p4', 4000);
  const p5 = writePlan(plansDir, '2026-09/p5', 5000);
  const p6 = writePlan(plansDir, '2026-10/p6', 6000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [p6, p5, p4, p3, p2] });
});

test('chooses the five newest among the months and topics alone', (t) => {
  const plansDir = makeTempDir(t);
  const p1 = writePlan(plansDir, '2026-11/p1', 1000);
  const p2 = writePlan(plansDir, '2026-11/p2', 2000);
  const p3 = writePlan(plansDir, '2026-11/p3', 3000);
  const p4 = writePlan(plansDir, '2026-11/p4', 4000);
  const p5 = writePlan(plansDir, '2026-11/p5', 5000);

  writePlan(plansDir, '2026-11/new plan', 6000);
  writePlan(plansDir, '2026-13/p7', 7000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [p5, p4, p3, p2, p1] });
});

test('lists none without a plans directory, in an empty one or in an empty month', (t) => {
  const plansDir = makeTempDir(t);
  const emptyMonth = makeTempDir(t);

  mkdirSync(join(emptyMonth, '2026-11'));

  assert.deepEqual(
    [readPlans(join(plansDir, 'plans')), readPlans(plansDir), readPlans(emptyMonth)],
    [{ kind: 'plans', paths: [] }, { kind: 'plans', paths: [] }, { kind: 'plans', paths: [] }],
  );
});

test('fails with the path when the plans directory cannot be read', (t) => {
  const plansDir = join(makeTempDir(t), 'plans');

  writeFileSync(plansDir, 'a file where the directory goes');

  const read = readPlans(plansDir);

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*\/plans: ENOTDIR/u);
});

test('fails with the path when a month directory cannot be read', (t) => {
  const plansDir = makeTempDir(t);
  const monthDirectory = join(plansDir, '2026-11');

  writePlan(plansDir, '2026-11/topic', 1000);
  chmodSync(monthDirectory, 0o000);

  const read = readPlans(plansDir);

  // Given back before the test ends, so the temporary directory can be removed.
  chmodSync(monthDirectory, 0o700);

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*\/2026-11: EACCES/u);
});

test('fails with the path when a topic directory cannot be searched', (t) => {
  const plansDir = makeTempDir(t);
  const topicDirectory = dirname(writePlan(plansDir, '2026-11/topic', 1000));

  chmodSync(topicDirectory, 0o000);

  const read = readPlans(plansDir);

  // Given back before the test ends, so the temporary directory can be removed.
  chmodSync(topicDirectory, 0o700);

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*\/2026-11\/topic\/plan\.md: EACCES/u);
});

// The plan file of a plan, named <month>/<topic>, modified seconds after the
// epoch; its path.
function writePlan(plansDir: string, plan: string, seconds: number): string {
  return writeFile(join(plansDir, plan), 'plan.md', seconds);
}

// A file in the directory, created with its parents, modified seconds after
// the epoch; its path.
function writeFile(directory: string, name: string, seconds: number): string {
  const path = join(directory, name);

  mkdirSync(directory, { recursive: true });
  writeFileSync(path, '# Plan\n');
  utimesSync(path, seconds, seconds);

  return path;
}
