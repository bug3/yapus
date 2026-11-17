import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { runGit } from '../../../../helpers/run-git.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'upgrade', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const FIRST_LINE = '{"time":"2026-11-15T10:00:00.000Z","prompt":"go"}\n';
const LATER_LINE = '{"time":"2026-12-02T08:30:00.000Z","prompt":"on"}\n';
const MOVED_LOG = '15T10-00-00Z_s1.jsonl';
const OCTOBER = new Date('2026-10-05T12:00:00.000Z');
const NOVEMBER = new Date('2026-11-20T12:00:00.000Z');
const PROGRAM = 'yapus delegator upgrade';

type Files = readonly (readonly [name: string, text: string])[];

// A project in the older layout: one log beside its ignore file, and one plan
// with a detail file, written in November.
const OLD_FILES: Files = [
  ['prompts/.gitignore', '*\n'],
  ['prompts/s1.jsonl', FIRST_LINE + LATER_LINE],
  ['plans/topic.md', 'the plan\n'],
  ['plans/topic/S1.md', 'the slice\n'],
];

test('prints every move in the order it is made and moves the logs and the plans', (t) => {
  const projectRoot = makeProject(t, OLD_FILES);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stderr, run.stdout],
    [
      0,
      '',
      'prompts/.gitignore -> sessions/.gitignore\n'
      + 'prompts/s1.jsonl -> sessions/2026-11/15T10-00-00Z_s1.jsonl\n'
      + 'prompts removed\n'
      + 'plans/topic -> plans/2026-11/topic\n'
      + 'plans/topic.md -> plans/2026-11/topic/plan.md\n',
    ],
  );
  assert.deepEqual(listTree(projectRoot), [
    'plans',
    'plans/2026-11',
    'plans/2026-11/topic',
    'plans/2026-11/topic/S1.md',
    'plans/2026-11/topic/plan.md',
    'sessions',
    'sessions/.gitignore',
    'sessions/2026-11',
    'sessions/2026-11/15T10-00-00Z_s1.jsonl',
  ]);
});

// A standard output that refuses the write stops the program at the list.
test('moves nothing when the list cannot be printed', (t) => {
  const projectRoot = makeProject(t, OLD_FILES);
  const before = listTree(projectRoot);
  const unwritable = openSync(MAIN, 'r');

  t.after(() => {
    closeSync(unwritable);
  });

  const run = spawnSync(process.execPath, [MAIN, projectRoot], {
    encoding: 'utf8',
    stdio: ['ignore', unwritable, 'pipe'],
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(run.status, 2);
  assert.match(run.stderr, /^yapus delegator upgrade: crashed: [^\n]*\n$/u);
  assert.deepEqual(listTree(projectRoot), before);
});

test('prints nothing to move and changes nothing on a second run', (t) => {
  const projectRoot = makeProject(t, OLD_FILES);

  runUpgrade([projectRoot]);

  const moved = listTree(projectRoot);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual([run.status, run.stdout, run.stderr], [0, 'nothing to move\n', '']);
  assert.deepEqual(listTree(projectRoot), moved);
});

test('prints nothing to move and creates nothing in a project without .yapus', (t) => {
  const projectRoot = makeTempDir(t);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual([run.status, run.stdout, run.stderr], [0, 'nothing to move\n', '']);
  assert.deepEqual(readdirSync(projectRoot), []);
});

test('moves a log to the stamp of its first time with its lines as they were', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', FIRST_LINE + LATER_LINE]]);

  runUpgrade([projectRoot]);

  assert.equal(
    readFileSync(join(projectRoot, '.yapus', 'sessions', '2026-11', MOVED_LOG), 'utf8'),
    FIRST_LINE + LATER_LINE,
  );
});

test('moves a plan with its detail files into the month of its earliest file time', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'the slice\n'],
    ['plans/topic/reviews/r1.md', 'the review\n'],
  ]);

  setTime(join(projectRoot, '.yapus', 'plans', 'topic', 'S1.md'), OCTOBER);

  const run = runUpgrade([projectRoot]);
  const planDirectory = join(projectRoot, '.yapus', 'plans', '2026-10', 'topic');

  assert.deepEqual(
    [run.status, run.stdout],
    [0, 'plans/topic -> plans/2026-10/topic\nplans/topic.md -> plans/2026-10/topic/plan.md\n'],
  );
  assert.deepEqual(
    [
      readFileSync(join(planDirectory, 'plan.md'), 'utf8'),
      readFileSync(join(planDirectory, 'S1.md'), 'utf8'),
      readFileSync(join(planDirectory, 'reviews', 'r1.md'), 'utf8'),
      listTree(projectRoot).length,
    ],
    ['the plan\n', 'the slice\n', 'the review\n', 7],
  );
});

test('gives a plan without detail files a directory in its month', (t) => {
  const projectRoot = makeProject(t, [['plans/solo.md', 'the plan\n']]);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [0, 'plans/solo.md -> plans/2026-11/solo/plan.md\n', ''],
  );
  assert.deepEqual(listTree(projectRoot), [
    'plans',
    'plans/2026-11',
    'plans/2026-11/solo',
    'plans/2026-11/solo/plan.md',
  ]);
});

// The first rename of an earlier run put the directory under November; the
// plan's files were all written in October.
test('puts the plan file of a half-moved plan into the month that holds its directory', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/2026-11/topic/S1.md', 'the slice\n'],
  ]);

  setTime(join(projectRoot, '.yapus', 'plans', 'topic.md'), OCTOBER);
  setTime(join(projectRoot, '.yapus', 'plans', '2026-11', 'topic', 'S1.md'), OCTOBER);

  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [0, 'plans/topic.md -> plans/2026-11/topic/plan.md\n', ''],
  );
  assert.deepEqual(listTree(projectRoot), [
    'plans',
    'plans/2026-11',
    'plans/2026-11/topic',
    'plans/2026-11/topic/S1.md',
    'plans/2026-11/topic/plan.md',
  ]);
});

test('creates the sessions directory and its month private, a month of plans not', (t) => {
  const projectRoot = makeProject(t, OLD_FILES);
  const stateDirectory = join(projectRoot, '.yapus');

  runUpgrade([projectRoot]);

  assert.deepEqual(
    [
      getMode(join(stateDirectory, 'sessions')),
      getMode(join(stateDirectory, 'sessions', '2026-11')),
      getMode(join(stateDirectory, 'plans', '2026-11')),
    ],
    [0o700, 0o700, getMode(join(stateDirectory, 'plans'))],
  );
});

test('writes an ignore file holding * when the older directory has none', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', FIRST_LINE]]);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout],
    [0, 'prompts/s1.jsonl -> sessions/2026-11/15T10-00-00Z_s1.jsonl\nprompts removed\n'],
  );
  assert.equal(readFileSync(join(projectRoot, '.yapus', 'sessions', '.gitignore'), 'utf8'), '*\n');
});

test('moves an edited ignore file when the sessions directory has none', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '!*.jsonl\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
  ]);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout],
    [
      0,
      'prompts/.gitignore -> sessions/.gitignore\n'
      + 'prompts/s1.jsonl -> sessions/2026-11/15T10-00-00Z_s1.jsonl\n'
      + 'prompts removed\n',
    ],
  );
  assert.equal(
    readFileSync(join(projectRoot, '.yapus', 'sessions', '.gitignore'), 'utf8'),
    '!*.jsonl\n',
  );
});

test('leaves the moved logs out of git status', (t) => {
  const projectRoot = makeTempRepo(t);

  writeFiles(projectRoot, [['prompts/s1.jsonl', FIRST_LINE]]);
  runUpgrade([projectRoot]);

  assert.deepEqual(
    [listTree(projectRoot).includes(`sessions/2026-11/${ MOVED_LOG }`), getStatus(projectRoot)],
    [true, ''],
  );
});

// The earlier run moved the log and stopped before the older ignore file.
test('finishes a run that stopped before the ignore file', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['sessions/.gitignore', '*\n'],
    ['sessions/2026-11/15T10-00-00Z_s1.jsonl', FIRST_LINE],
  ]);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [0, 'prompts/.gitignore removed\nprompts removed\n', ''],
  );
  assert.deepEqual(listTree(projectRoot), [
    'sessions',
    'sessions/.gitignore',
    'sessions/2026-11',
    'sessions/2026-11/15T10-00-00Z_s1.jsonl',
  ]);
});

test('removes the older directory once it is empty', (t) => {
  const projectRoot = makeProject(t, [['prompts/', '']]);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual([run.status, run.stdout, run.stderr], [0, 'prompts removed\n', '']);
  assert.deepEqual(listTree(projectRoot), []);
});

for (const [name, files, left] of [
  [
    'a log whose session has a file in the sessions directory',
    [
      ['prompts/s1.jsonl', FIRST_LINE],
      ['sessions/.gitignore', '*\n'],
      ['sessions/2026-12/02T08-30-00Z_s1.jsonl', LATER_LINE],
    ],
    'prompts/s1.jsonl is left: the session already has sessions/2026-12/02T08-30-00Z_s1.jsonl; '
    + 'merge or remove one by hand',
  ],
  [
    'a log with no line that carries a time',
    [['prompts/s1.jsonl', '{"prompt":"go"}\n']],
    'prompts/s1.jsonl is left: no line carries a time; move or remove it by hand',
  ],
  [
    'a file of the older directory that is no log',
    [['prompts/notes.txt', 'a note\n']],
    'prompts/notes.txt is left: it is no prompt log; move or remove it by hand',
  ],
  [
    'an ignore file that differs from the one of the sessions directory',
    [['prompts/.gitignore', '!*.jsonl\n'], ['sessions/.gitignore', '*\n']],
    'prompts/.gitignore is left: it differs from sessions/.gitignore; keep one by hand',
  ],
  [
    'a plan file whose name is no topic',
    [['plans/two words.md', 'the plan\n']],
    'plans/two words.md is left: its name is no topic; rename it',
  ],
  [
    'a plan file named as a month',
    [['plans/2026-11.md', 'the plan\n'], ['plans/2026-11/topic/plan.md', 'another plan\n']],
    'plans/2026-11.md is left: its name is a month; rename it',
  ],
  [
    'a plan whose topic a month holds with a plan file',
    [['plans/topic.md', 'the plan\n'], ['plans/2026-10/topic/plan.md', 'the twin\n']],
    'plans/topic.md is left: plans/2026-10/topic/plan.md exists; '
    + 'rename one of the two topics by hand',
  ],
  [
    'a plan with a detail file named plan.md',
    [['plans/topic.md', 'the plan\n'], ['plans/topic/plan.md', 'a detail file\n']],
    'plans/topic.md is left: plans/topic/plan.md has the name the plan takes; rename that file',
  ],
  [
    'a plan whose directory stands beside one a month holds',
    [
      ['plans/topic.md', 'the plan\n'],
      ['plans/topic/S1.md', 'a slice\n'],
      ['plans/2026-10/topic/S2.md', 'another slice\n'],
    ],
    'plans/topic.md is left: plans/topic stands beside plans/2026-10/topic; merge the two by hand',
  ],
  [
    'a plan whose topic two months hold',
    [
      ['plans/topic.md', 'the plan\n'],
      ['plans/2026-10/topic/S1.md', 'a slice\n'],
      ['plans/2026-11/topic/S2.md', 'another slice\n'],
    ],
    'plans/topic.md is left: plans/2026-10/topic and plans/2026-11/topic both hold the topic; '
    + 'keep one by hand',
  ],
] as const) {
  test(`leaves ${ name } in place, names it on stderr and exits 2`, (t) => {
    const projectRoot = makeProject(t, files);
    const before = listTree(projectRoot);
    const run = runUpgrade([projectRoot]);

    assert.deepEqual(
      [run.status, run.stdout, run.stderr],
      [2, 'nothing to move\n', `${ PROGRAM }: ${ left }\n`],
    );
    assert.deepEqual(listTree(projectRoot), before);
  });
}

test('moves the other logs and keeps the older directory when a log is left', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/s1.jsonl', FIRST_LINE],
    ['prompts/s2.jsonl', '{"prompt":"go"}\n'],
  ]);
  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      'prompts/s1.jsonl -> sessions/2026-11/15T10-00-00Z_s1.jsonl\n',
      `${ PROGRAM }: prompts/s2.jsonl is left: no line carries a time; `
      + 'move or remove it by hand\n',
    ],
  );
  assert.deepEqual(listTree(projectRoot), [
    'prompts',
    'prompts/s2.jsonl',
    'sessions',
    'sessions/.gitignore',
    'sessions/2026-11',
    'sessions/2026-11/15T10-00-00Z_s1.jsonl',
  ]);
});

// The log of a session that has a file already holds prompts and stays.
test('keeps a left log out of git status under the older ignore file', (t) => {
  const projectRoot = makeTempRepo(t);

  writeFiles(projectRoot, [
    ['prompts/.gitignore', '*\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
    ['prompts/s2.jsonl', FIRST_LINE],
    ['sessions/.gitignore', '*\n'],
    ['sessions/2026-12/02T08-30-00Z_s1.jsonl', LATER_LINE],
  ]);

  const run = runUpgrade([projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout, getStatus(projectRoot)],
    [2, 'prompts/s2.jsonl -> sessions/2026-11/15T10-00-00Z_s2.jsonl\n', ''],
  );
});

// The plans directory takes no new entry, so the first plan's month cannot
// be created.
test('names the move that failed, makes none after it and exits 2', (t) => {
  const projectRoot = makeProject(t, [['plans/a.md', 'a plan\n'], ['plans/b.md', 'b plan\n']]);
  const plansDirectory = join(projectRoot, '.yapus', 'plans');

  chmodSync(plansDirectory, 0o555);

  const run = runUpgrade([projectRoot]);

  chmodSync(plansDirectory, 0o755);

  assert.deepEqual(
    [run.status, run.stdout],
    [2, 'plans/a.md -> plans/2026-11/a/plan.md\nplans/b.md -> plans/2026-11/b/plan.md\n'],
  );
  assert.match(
    run.stderr,
    /^yapus delegator upgrade: plans\/a\.md -> plans\/2026-11\/a\/plan\.md failed: EACCES[^\n]*; no move after it is made; repair it and run the command again\n$/u,
  );
  assert.deepEqual(listTree(projectRoot), ['plans', 'plans/a.md', 'plans/b.md']);
});

test('moves the files of the project in its argument through run.sh', (t) => {
  const projectRoot = makeProject(t, [['plans/solo.md', 'the plan\n']]);
  const run = spawnSync('bash', [RUN_SH, 'claude/delegator/upgrade', projectRoot], {
    cwd: makeTempDir(t),
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [0, 'plans/solo.md -> plans/2026-11/solo/plan.md\n', ''],
  );
});

test('refuses a relative project directory with one usage line and moves nothing', (t) => {
  const projectRoot = makeProject(t, [['plans/solo.md', 'the plan\n']]);
  const run = spawnSync(process.execPath, [MAIN, '.'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.match(run.stderr, /^yapus delegator upgrade: usage: [^\n]*\n$/u);
  assert.deepEqual(listTree(projectRoot), ['plans', 'plans/solo.md']);
});

test('refuses no argument and an empty one with one usage line', () => {
  const none = runUpgrade([]);
  const empty = runUpgrade(['']);

  assert.deepEqual([none.status, none.stdout, empty.status, empty.stdout], [2, '', 2, '']);
  assert.match(none.stderr, /^yapus delegator upgrade: usage: [^\n]*\n$/u);
  assert.match(empty.stderr, /^yapus delegator upgrade: usage: [^\n]*\n$/u);
});

test('refuses a second argument with one usage line and moves nothing', (t) => {
  const projectRoot = makeProject(t, [['plans/solo.md', 'the plan\n']]);
  const run = runUpgrade([projectRoot, projectRoot]);

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.match(run.stderr, /^yapus delegator upgrade: usage: [^\n]*\n$/u);
  assert.deepEqual(listTree(projectRoot), ['plans', 'plans/solo.md']);
});

function runUpgrade(args: readonly string[]) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// A project whose .yapus/ holds the files, each written in November.
function makeProject(t: TestContext, files: Files): string {
  const projectRoot = makeTempDir(t);

  writeFiles(projectRoot, files);

  return projectRoot;
}

// Writes each file under .yapus/ with its directories; a name that ends in
// '/' is an empty directory.
function writeFiles(projectRoot: string, files: Files): void {
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
}

function setTime(path: string, time: Date): void {
  utimesSync(path, time, time);
}

// Every path below .yapus/, sorted; none when it does not exist.
function listTree(projectRoot: string): string[] {
  return readdirSync(join(projectRoot, '.yapus'), { recursive: true })
    .map((path) => String(path))
    .sort();
}

function getMode(path: string): number {
  return statSync(path).mode & 0o777;
}

function getStatus(repo: string): string {
  return runGit(['status', '--porcelain'], repo);
}
