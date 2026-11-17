import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  type Applied,
  applyMoves,
} from '../../../../../hooks/claude/delegator/upgrade/apply-moves.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const LOG_MOVE = {
  kind: 'log',
  from: 'prompts/s1.jsonl',
  to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl',
} as const;
const IGNORE_MOVE = {
  kind: 'ignore',
  from: 'prompts/.gitignore',
  to: 'sessions/.gitignore',
} as const;
const DIRECTORY_MOVE = { kind: 'plan', from: 'plans/topic', to: 'plans/2026-11/topic' } as const;
const PLAN_MOVE = {
  kind: 'plan',
  from: 'plans/topic.md',
  to: 'plans/2026-11/topic/plan.md',
} as const;
const AFTER_FAILURE = 'no move after it is made; repair it and run the command again';

type Files = readonly (readonly [name: string, text: string])[];

test('gives done for no move and creates nothing', (t) => {
  const projectRoot = makeTempDir(t);

  assert.deepEqual(applyMoves(projectRoot, []), { kind: 'done' });
  assert.deepEqual(readdirSync(projectRoot), []);
});

test('renames a log into a private month of a private sessions directory', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', 'a line\n']]);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  assert.deepEqual(applyMoves(projectRoot, [LOG_MOVE]), { kind: 'done' });
  assert.deepEqual(
    [
      listTree(projectRoot),
      getMode(sessionsDirectory),
      getMode(join(sessionsDirectory, '2026-11')),
      readFileSync(join(sessionsDirectory, '2026-11', '15T10-00-00Z_s1.jsonl'), 'utf8'),
    ],
    [
      [
        'prompts',
        'sessions',
        'sessions/.gitignore',
        'sessions/2026-11',
        'sessions/2026-11/15T10-00-00Z_s1.jsonl',
      ],
      0o700,
      0o700,
      'a line\n',
    ],
  );
});

test('leaves the mode of the moved log as it was', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', 'a line\n']]);

  chmodSync(join(projectRoot, '.yapus', 'prompts', 's1.jsonl'), 0o640);
  applyMoves(projectRoot, [LOG_MOVE]);

  assert.equal(
    getMode(join(projectRoot, '.yapus', 'sessions', '2026-11', '15T10-00-00Z_s1.jsonl')),
    0o640,
  );
});

test('creates the sessions directory private for the ignore file and no month', (t) => {
  const projectRoot = makeProject(t, [['prompts/.gitignore', '!*.jsonl\n']]);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  assert.deepEqual(applyMoves(projectRoot, [IGNORE_MOVE]), { kind: 'done' });
  assert.deepEqual(
    [
      listTree(projectRoot),
      getMode(sessionsDirectory),
      readFileSync(join(sessionsDirectory, '.gitignore'), 'utf8'),
    ],
    [['prompts', 'sessions', 'sessions/.gitignore'], 0o700, '!*.jsonl\n'],
  );
});

test('leaves the mode of a sessions directory that exists', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['prompts/s1.jsonl', 'a line\n'],
    ['sessions/', ''],
  ]);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  chmodSync(sessionsDirectory, 0o755);

  assert.deepEqual(applyMoves(projectRoot, [IGNORE_MOVE, LOG_MOVE]), { kind: 'done' });
  assert.deepEqual(
    [getMode(sessionsDirectory), getMode(join(sessionsDirectory, '2026-11'))],
    [0o755, 0o700],
  );
});

test('creates the month of a plan and the directory of its file with the default mode', (t) => {
  const projectRoot = makeProject(t, [['plans/topic.md', 'the plan\n']]);
  const plansDirectory = join(projectRoot, '.yapus', 'plans');

  assert.deepEqual(applyMoves(projectRoot, [PLAN_MOVE]), { kind: 'done' });
  assert.deepEqual(
    [
      listTree(projectRoot),
      getMode(join(plansDirectory, '2026-11')),
      getMode(join(plansDirectory, '2026-11', 'topic')),
    ],
    [
      ['plans', 'plans/2026-11', 'plans/2026-11/topic', 'plans/2026-11/topic/plan.md'],
      getMode(plansDirectory),
      getMode(plansDirectory),
    ],
  );
});

test('renames the directory of a plan with its files, then the plan file into it', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
  ]);

  assert.deepEqual(applyMoves(projectRoot, [DIRECTORY_MOVE, PLAN_MOVE]), { kind: 'done' });
  assert.deepEqual(listTree(projectRoot), [
    'plans',
    'plans/2026-11',
    'plans/2026-11/topic',
    'plans/2026-11/topic/S1.md',
    'plans/2026-11/topic/plan.md',
  ]);
});

test('fails on a target file that exists and overwrites nothing', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/2026-11/topic/plan.md', 'the twin\n'],
  ]);
  const plansDirectory = join(projectRoot, '.yapus', 'plans');

  assert.deepEqual(applyMoves(projectRoot, [PLAN_MOVE]), {
    kind: 'failure',
    detail: 'plans/topic.md -> plans/2026-11/topic/plan.md failed: '
      + `plans/2026-11/topic/plan.md exists; ${ AFTER_FAILURE }`,
  });
  assert.deepEqual(
    [
      readFileSync(join(plansDirectory, 'topic.md'), 'utf8'),
      readFileSync(join(plansDirectory, '2026-11', 'topic', 'plan.md'), 'utf8'),
    ],
    ['the plan\n', 'the twin\n'],
  );
});

// A rename would replace the empty directory without a word.
test('fails on a target directory that exists, an empty one too', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic/S1.md', 'a slice\n'],
    ['plans/2026-11/topic/', ''],
  ]);

  assert.deepEqual(applyMoves(projectRoot, [DIRECTORY_MOVE]), {
    kind: 'failure',
    detail: 'plans/topic -> plans/2026-11/topic failed: '
      + `plans/2026-11/topic exists; ${ AFTER_FAILURE }`,
  });
  assert.equal(existsSync(join(projectRoot, '.yapus', 'plans', 'topic', 'S1.md')), true);
});

test('stops at the first move that fails and makes none after it', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['plans/topic/S1.md', 'a slice\n'],
    ['plans/2026-11/topic/', ''],
    ['prompts/s1.jsonl', 'a line\n'],
  ]);
  const applied = applyMoves(projectRoot, [LOG_MOVE, DIRECTORY_MOVE, PLAN_MOVE]);

  assert.equal(applied.kind, 'failure');
  assert.deepEqual(listTree(projectRoot), [
    'plans',
    'plans/2026-11',
    'plans/2026-11/topic',
    'plans/topic',
    'plans/topic.md',
    'plans/topic/S1.md',
    'prompts',
    'sessions',
    'sessions/.gitignore',
    'sessions/2026-11',
    'sessions/2026-11/15T10-00-00Z_s1.jsonl',
  ]);
});

test('fails with the move when its source is gone', (t) => {
  const projectRoot = makeProject(t, [['plans/', '']]);
  const applied = applyMoves(projectRoot, [PLAN_MOVE]);

  assert.match(
    getDetail(applied),
    /^plans\/topic\.md -> plans\/2026-11\/topic\/plan\.md failed: ENOENT[^\n]*; no move after it is made; repair it and run the command again$/u,
  );
});

// prepareMonthDirectory throws when the sessions directory cannot be made.
test('fails with the move when the month of a log cannot be prepared', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', 'a line\n'], ['sessions', 'a file\n']]);
  const applied = applyMoves(projectRoot, [LOG_MOVE]);

  assert.match(
    getDetail(applied),
    /^prompts\/s1\.jsonl -> sessions\/2026-11\/15T10-00-00Z_s1\.jsonl failed: ENOTDIR/u,
  );
  assert.equal(existsSync(join(projectRoot, '.yapus', 'prompts', 's1.jsonl')), true);
});

test('removes a file, then the directory it emptied', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['sessions/.gitignore', '*\n'],
  ]);
  const applied = applyMoves(projectRoot, [
    { kind: 'removal', path: 'prompts/.gitignore' },
    { kind: 'removal', path: 'prompts' },
  ]);

  assert.deepEqual(applied, { kind: 'done' });
  assert.deepEqual(listTree(projectRoot), ['sessions', 'sessions/.gitignore']);
});

test('fails on the removal of a directory that is not empty and removes nothing', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', 'a line\n']]);
  const applied = applyMoves(projectRoot, [{ kind: 'removal', path: 'prompts' }]);

  assert.match(
    getDetail(applied),
    /^prompts removed failed: ENOTEMPTY[^\n]*; no move after it is made; /u,
  );
  assert.deepEqual(listTree(projectRoot), ['prompts', 'prompts/s1.jsonl']);
});

// A project whose .yapus/ holds the files; a name that ends in '/' is an
// empty directory.
function makeProject(t: TestContext, files: Files): string {
  const projectRoot = makeTempDir(t);

  for (const [name, text] of files) {
    const path = join(projectRoot, '.yapus', name);

    if (name.endsWith('/')) {
      mkdirSync(path, { recursive: true });
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
  }

  return projectRoot;
}

// Every path below .yapus/, sorted.
function listTree(projectRoot: string): string[] {
  return readdirSync(join(projectRoot, '.yapus'), { recursive: true })
    .map((path) => String(path))
    .sort();
}

// The detail of a failure; none for moves that were made.
function getDetail(applied: Applied): string {
  return applied.kind === 'failure' ? applied.detail : '';
}

function getMode(path: string): number {
  return statSync(path).mode & 0o777;
}
