import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { findPlanMoves } from '../../../../../hooks/claude/delegator/upgrade/find-plan-moves.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const SEPTEMBER = new Date('2026-09-30T23:59:59.000Z');
const OCTOBER = new Date('2026-10-01T00:00:00.000Z');
const NOVEMBER = new Date('2026-11-20T12:00:00.000Z');

type Files = readonly (readonly [name: string, text: string])[];

test('finds no move in a project without a plans directory', (t) => {
  assert.deepEqual(findPlanMoves(makeTempDir(t)), { moves: [], left: [] });
});

test('finds no move among the plans of the present layout', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/2026-11/topic/plan.md', 'the plan\n'],
    ['plans/2026-11/topic/S1.md', 'a slice\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), { moves: [], left: [] });
});

test('names no directory without its plan file and no file with another ending', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/orphan/S1.md', 'a slice\n'],
    ['plans/notes.txt', 'a note\n'],
    ['plans/folder.md/S1.md', 'a slice\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), { moves: [], left: [] });
});

test('moves the directory of a plan into its month, then the plan file into it', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [
      { kind: 'plan', from: 'plans/topic', to: 'plans/2026-11/topic' },
      { kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' },
    ],
    left: [],
  });
});

test('moves the file of a plan without detail files alone', (t) => {
  const projectRoot = makeProject(t, [['plans/solo.md', 'the plan\n']]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [{ kind: 'plan', from: 'plans/solo.md', to: 'plans/2026-11/solo/plan.md' }],
    left: [],
  });
});

test('changes nothing while it finds the moves of the plans', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
  ]);

  findPlanMoves(projectRoot);

  assert.deepEqual(
    readdirSync(join(projectRoot, '.yapus'), { recursive: true }).sort(),
    ['plans', 'plans/topic', 'plans/topic.md', 'plans/topic/S1.md'],
  );
});

test('takes the month of the plan file when it is the earliest', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
  ]);

  setTime(join(projectRoot, '.yapus', 'plans', 'topic.md'), OCTOBER);

  assert.deepEqual(
    findPlanMoves(projectRoot).moves.map((move) => (move.kind === 'plan' ? move.to : '')),
    ['plans/2026-10/topic', 'plans/2026-10/topic/plan.md'],
  );
});

test('takes the UTC month of a file below a directory of the plan, the earliest', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
    ['plans/topic/reviews/r1.md', 'a review\n'],
  ]);

  setTime(join(projectRoot, '.yapus', 'plans', 'topic', 'S1.md'), OCTOBER);
  setTime(join(projectRoot, '.yapus', 'plans', 'topic', 'reviews', 'r1.md'), SEPTEMBER);

  assert.deepEqual(
    findPlanMoves(projectRoot).moves.map((move) => (move.kind === 'plan' ? move.to : '')),
    ['plans/2026-09/topic', 'plans/2026-09/topic/plan.md'],
  );
});

test('takes no month from the time of a directory', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/reviews/r1.md', 'a review\n'],
  ]);

  setTime(join(projectRoot, '.yapus', 'plans', 'topic.md'), OCTOBER);
  setTime(join(projectRoot, '.yapus', 'plans', 'topic', 'reviews', 'r1.md'), OCTOBER);
  setTime(join(projectRoot, '.yapus', 'plans', 'topic', 'reviews'), SEPTEMBER);
  setTime(join(projectRoot, '.yapus', 'plans', 'topic'), SEPTEMBER);

  assert.deepEqual(
    findPlanMoves(projectRoot).moves.map((move) => (move.kind === 'plan' ? move.to : '')),
    ['plans/2026-10/topic', 'plans/2026-10/topic/plan.md'],
  );
});

test('gives the moves of the plans in the order of their topics', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/beta.md', 'a plan\n'],
    ['plans/alpha.md', 'a plan\n'],
    ['plans/alpha/S1.md', 'a slice\n'],
  ]);

  assert.deepEqual(
    findPlanMoves(projectRoot).moves.map((move) => (move.kind === 'plan' ? move.from : '')),
    ['plans/alpha', 'plans/alpha.md', 'plans/beta.md'],
  );
});

// The first rename of an earlier run put the directory under November.
test('moves the plan file into the month that holds its directory, whatever its time', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/2026-11/topic/S1.md', 'a slice\n'],
    ['plans/2026-10/other/plan.md', 'another plan\n'],
  ]);

  setTime(join(projectRoot, '.yapus', 'plans', 'topic.md'), SEPTEMBER);
  setTime(join(projectRoot, '.yapus', 'plans', '2026-11', 'topic', 'S1.md'), SEPTEMBER);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [{ kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' }],
    left: [],
  });
});

test('moves the plan file into an empty directory a month holds', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/2026-10/topic/', ''],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [{ kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-10/topic/plan.md' }],
    left: [],
  });
});

test('takes a topic under a name that is no month, a file and a link for no holder', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/2026-13/topic/S1.md', 'a slice\n'],
    ['plans/2026-09/topic', 'a file\n'],
    ['plans/elsewhere/', ''],
    ['plans/2026-08/', ''],
  ]);
  const plansDirectory = join(projectRoot, '.yapus', 'plans');

  symlinkSync(join(plansDirectory, 'elsewhere'), join(plansDirectory, '2026-08', 'topic'));

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [{ kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' }],
    left: [],
  });
});

test('leaves a plan whose topic a month holds with a plan file and names that file', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
    ['plans/2026-09/topic/S2.md', 'a slice\n'],
    ['plans/2026-10/topic/plan.md', 'the twin\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [],
    left: [
      {
        path: 'plans/topic.md',
        reason: 'plans/2026-10/topic/plan.md exists; rename one of the two topics by hand',
      },
    ],
  });
});

test('leaves a plan whose directory stands beside the one a month holds', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
    ['plans/2026-10/topic/S2.md', 'a slice\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [],
    left: [
      {
        path: 'plans/topic.md',
        reason: 'plans/topic stands beside plans/2026-10/topic; merge the two by hand',
      },
    ],
  });
});

test('leaves a plan whose topic two months hold and names both', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/2026-11/topic/S1.md', 'a slice\n'],
    ['plans/2026-10/topic/S2.md', 'a slice\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [],
    left: [
      {
        path: 'plans/topic.md',
        reason: 'plans/2026-10/topic and plans/2026-11/topic both hold the topic; '
          + 'keep one by hand',
      },
    ],
  });
});

test('leaves a plan with a detail entry named plan.md, a file or a directory', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/a.md', 'a plan\n'],
    ['plans/a/plan.md', 'a detail file\n'],
    ['plans/b.md', 'b plan\n'],
    ['plans/b/plan.md/', ''],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [],
    left: [
      {
        path: 'plans/a.md',
        reason: 'plans/a/plan.md has the name the plan takes; rename that file',
      },
      {
        path: 'plans/b.md',
        reason: 'plans/b/plan.md has the name the plan takes; rename that file',
      },
    ],
  });
});

test('leaves a plan file whose name is no topic and moves the plan beside it', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/.hidden.md', 'a plan\n'],
    ['plans/two words.md', 'a plan\n'],
    ['plans/topic.md', 'the plan\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [{ kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' }],
    left: [
      { path: 'plans/.hidden.md', reason: 'its name is no topic; rename it' },
      { path: 'plans/two words.md', reason: 'its name is no topic; rename it' },
    ],
  });
});

// plans/2026-10/ would be read as the plan's own directory and moved.
test('leaves a plan file named as a month', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/2026-10.md', 'a plan\n'],
    ['plans/2026-10/topic/plan.md', 'another plan\n'],
  ]);

  assert.deepEqual(findPlanMoves(projectRoot), {
    moves: [],
    left: [{ path: 'plans/2026-10.md', reason: 'its name is a month; rename it' }],
  });
});

test('leaves the plans directory when it cannot be read', (t) => {
  const projectRoot = makeProject(t, [['plans/topic.md', 'the plan\n']]);
  const plansDirectory = join(projectRoot, '.yapus', 'plans');

  chmodSync(plansDirectory, 0o000);

  const found = findPlanMoves(projectRoot);

  chmodSync(plansDirectory, 0o755);

  assert.deepEqual([found.moves, found.left.map(({ path }) => path)], [[], ['plans']]);
  assert.match(
    found.left.at(0)?.reason ?? '',
    /^it cannot be read: EACCES[^\n]*; make it readable$/u,
  );
});

test('leaves a plan whose directory cannot be read and moves the plan beside it', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/closed.md', 'a plan\n'],
    ['plans/closed/S1.md', 'a slice\n'],
    ['plans/topic.md', 'the plan\n'],
  ]);
  const detailDirectory = join(projectRoot, '.yapus', 'plans', 'closed');

  chmodSync(detailDirectory, 0o000);

  const found = findPlanMoves(projectRoot);

  chmodSync(detailDirectory, 0o755);

  assert.deepEqual(
    [found.moves, found.left.map(({ path }) => path)],
    [
      [{ kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' }],
      ['plans/closed.md'],
    ],
  );
  assert.match(
    found.left.at(0)?.reason ?? '',
    /^its files cannot be read: EACCES[^\n]*; make them readable$/u,
  );
});

// A project whose .yapus/ holds the files, each written in November; a name
// that ends in '/' is an empty directory.
function makeProject(t: TestContext, files: Files): string {
  const projectRoot = makeTempDir(t);

  for (const [name, text] of files) {
    const path = join(projectRoot, '.yapus', name);

    if (name.endsWith('/')) {
      mkdirSync(path, { recursive: true });
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      setTime(path, NOVEMBER);
    }
  }

  return projectRoot;
}

function setTime(path: string, time: Date): void {
  utimesSync(path, time, time);
}
