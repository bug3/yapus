import assert from 'node:assert/strict';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPlans } from '../../../../../hooks/claude/delegator/recall/read-plans.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('lists the plan files newest first, by name at one time', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, 'old.md', 1000);
  writePlan(plansDir, 'new.md', 3000);
  writePlan(plansDir, 'b.md', 2000);
  writePlan(plansDir, 'a.md', 2000);

  assert.deepEqual(readPlans(plansDir), {
    kind: 'plans',
    paths: [
      join(plansDir, 'new.md'),
      join(plansDir, 'a.md'),
      join(plansDir, 'b.md'),
      join(plansDir, 'old.md'),
    ],
  });
});

test('lists no file from a subdirectory and no file that is not markdown', (t) => {
  const plansDir = makeTempDir(t);

  mkdirSync(join(plansDir, 'topic'));
  mkdirSync(join(plansDir, 'folder.md'));
  writePlan(join(plansDir, 'topic'), 'S1.md', 3000);
  writePlan(plansDir, 'notes.txt', 3000);
  writePlan(plansDir, 'topic.md', 1000);

  assert.deepEqual(readPlans(plansDir), { kind: 'plans', paths: [join(plansDir, 'topic.md')] });
});

test('lists the five newest plan files', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, 'p1.md', 1000);
  writePlan(plansDir, 'p2.md', 2000);
  writePlan(plansDir, 'p3.md', 3000);
  writePlan(plansDir, 'p4.md', 4000);
  writePlan(plansDir, 'p5.md', 5000);
  writePlan(plansDir, 'p6.md', 6000);

  assert.deepEqual(readPlans(plansDir), {
    kind: 'plans',
    paths: [
      join(plansDir, 'p6.md'),
      join(plansDir, 'p5.md'),
      join(plansDir, 'p4.md'),
      join(plansDir, 'p3.md'),
      join(plansDir, 'p2.md'),
    ],
  });
});

test('skips a name with a space, a newline, a comma, a backtick or a brace', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, 'a plan.md', 3000);
  writePlan(plansDir, 'line\nbreak.md', 3000);
  writePlan(plansDir, 'a.md, b.md', 3000);
  writePlan(plansDir, 'tick`.md', 3000);
  writePlan(plansDir, '{path}.md', 3000);
  writePlan(plansDir, 'plan_v2-final.md', 1000);

  assert.deepEqual(readPlans(plansDir), {
    kind: 'plans',
    paths: [join(plansDir, 'plan_v2-final.md')],
  });
});

test('lists a name with Turkish letters, composed or decomposed', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, 'çalışma-ğüşöı.md', 2000);
  writePlan(plansDir, 's\u0327irket.md', 1000);

  assert.deepEqual(readPlans(plansDir), {
    kind: 'plans',
    paths: [join(plansDir, 'çalışma-ğüşöı.md'), join(plansDir, 's\u0327irket.md')],
  });
});

test('lists a name of 64 characters and skips one of 65', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, `${ 'a'.repeat(61) }.md`, 1000);
  writePlan(plansDir, `${ 'b'.repeat(62) }.md`, 2000);

  assert.deepEqual(readPlans(plansDir), {
    kind: 'plans',
    paths: [join(plansDir, `${ 'a'.repeat(61) }.md`)],
  });
});

test('chooses the five newest among the plain names alone', (t) => {
  const plansDir = makeTempDir(t);

  writePlan(plansDir, 'p1.md', 1000);
  writePlan(plansDir, 'p2.md', 2000);
  writePlan(plansDir, 'p3.md', 3000);
  writePlan(plansDir, 'p4.md', 4000);
  writePlan(plansDir, 'p5.md', 5000);
  writePlan(plansDir, 'new plan.md', 6000);

  assert.deepEqual(readPlans(plansDir), {
    kind: 'plans',
    paths: [
      join(plansDir, 'p5.md'),
      join(plansDir, 'p4.md'),
      join(plansDir, 'p3.md'),
      join(plansDir, 'p2.md'),
      join(plansDir, 'p1.md'),
    ],
  });
});

test('lists none when the project has no plans directory', (t) => {
  assert.deepEqual(readPlans(join(makeTempDir(t), 'plans')), { kind: 'plans', paths: [] });
});

test('fails with the path when the plans directory cannot be read', (t) => {
  const plansDir = join(makeTempDir(t), 'plans');

  writeFileSync(plansDir, 'a file where the directory goes');

  const read = readPlans(plansDir);

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*\/plans: ENOTDIR/u);
});

// A plan file whose modification time is seconds after the epoch.
function writePlan(directory: string, name: string, seconds: number): void {
  const path = join(directory, name);

  writeFileSync(path, '# Plan\n');
  utimesSync(path, seconds, seconds);
}
