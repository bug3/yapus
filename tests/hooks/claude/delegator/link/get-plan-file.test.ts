import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPlanFile } from '../../../../../hooks/claude/delegator/link/get-plan-file.ts';

const ROOT = '/project';
const PLANS = '/project/.yapus/plans';

test('gives the plan and the file for a file in a plan directory', () => {
  assert.deepEqual(getPlanFile(ROOT, `${ PLANS }/2026-11/topic/S1.md`), {
    plan: '2026-11/topic',
    file: 'S1.md',
  });
});

test('gives the path below the plan for a file in a directory of the plan', () => {
  assert.deepEqual(getPlanFile(ROOT, `${ PLANS }/2026-11/topic/reviews/first/r1.md`), {
    plan: '2026-11/topic',
    file: 'reviews/first/r1.md',
  });
});

test('gives the same plan for a root written with a trailing slash', () => {
  assert.deepEqual(getPlanFile('/project/', `${ PLANS }/2026-11/topic/S1.md`), {
    plan: '2026-11/topic',
    file: 'S1.md',
  });
});

test('gives none for the plans directory, a month and a plan directory', () => {
  assert.deepEqual(
    [
      getPlanFile(ROOT, PLANS),
      getPlanFile(ROOT, `${ PLANS }/2026-11`),
      getPlanFile(ROOT, `${ PLANS }/2026-11/topic`),
    ],
    [undefined, undefined, undefined],
  );
});

test('gives none for a file directly in the plans directory or in a month', () => {
  assert.deepEqual(
    [getPlanFile(ROOT, `${ PLANS }/topic.md`), getPlanFile(ROOT, `${ PLANS }/2026-11/plan.md`)],
    [undefined, undefined],
  );
});

test('gives none for a month that is none and a topic outside the NAME-1 form', () => {
  assert.deepEqual(
    [
      getPlanFile(ROOT, `${ PLANS }/topic/2026-11/S1.md`),
      getPlanFile(ROOT, `${ PLANS }/2026-00/topic/S1.md`),
      getPlanFile(ROOT, `${ PLANS }/2026-11/.git/S1.md`),
      getPlanFile(ROOT, `${ PLANS }/2026-11/a,b/S1.md`),
      getPlanFile(ROOT, `${ PLANS }/2026-11/API-redesign/S1.md`),
      getPlanFile(ROOT, `${ PLANS }/2026-11/dosya-adlandırma/S1.md`),
    ],
    [undefined, undefined, undefined, undefined, undefined, undefined],
  );
});

test('gives none for the plans of another root, of a root below and of a root above', () => {
  assert.deepEqual(
    [
      getPlanFile(ROOT, '/other/.yapus/plans/2026-11/topic/S1.md'),
      getPlanFile(ROOT, '/project/app/.yapus/plans/2026-11/topic/S1.md'),
      getPlanFile('/project/app', `${ PLANS }/2026-11/topic/S1.md`),
    ],
    [undefined, undefined, undefined],
  );
});

test('gives none for a directory whose name only starts as the plans directory', () => {
  assert.equal(getPlanFile(ROOT, '/project/.yapus/plans-old/2026-11/topic/S1.md'), undefined);
});

// A parent step is followed as text, to the place the path leads to.
test('reads a path with a parent step as the place it leads to', () => {
  assert.deepEqual(
    [
      getPlanFile(ROOT, `${ PLANS }/2026-11/topic/../other/S1.md`),
      getPlanFile(ROOT, `${ PLANS }/2026-11/topic/../../../../2026-11/topic/S1.md`),
    ],
    [{ plan: '2026-11/other', file: 'S1.md' }, undefined],
  );
});

// With the working directory as the root, a relative path would lead into it.
test('gives none for a relative path', () => {
  assert.equal(getPlanFile(process.cwd(), '.yapus/plans/2026-11/topic/S1.md'), undefined);
});
