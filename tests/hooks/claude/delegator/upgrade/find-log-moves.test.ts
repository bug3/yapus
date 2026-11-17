import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { findLogMoves } from '../../../../../hooks/claude/delegator/upgrade/find-log-moves.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIRST_LINE = '{"time":"2026-11-15T10:00:00.000Z","prompt":"go"}\n';
const LATER_LINE = '{"time":"2026-12-02T08:30:00.000Z","prompt":"on"}\n';
const NO_LOG = 'it is no prompt log; move or remove it by hand';

type Files = readonly (readonly [name: string, text: string])[];

test('finds no move in a project without the older directory', (t) => {
  const projectRoot = makeProject(t, [['sessions/2026-11/15T10-00-00Z_s1.jsonl', FIRST_LINE]]);

  assert.deepEqual(findLogMoves(projectRoot), { moves: [], left: [] });
});

test('takes a file named prompts for no older directory', (t) => {
  const projectRoot = makeProject(t, [['prompts', 'a file\n']]);

  assert.deepEqual(findLogMoves(projectRoot), { moves: [], left: [] });
});

test('moves each log to the file its first time names, then removes the directory', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/s2.jsonl', LATER_LINE],
    ['prompts/s1.jsonl', FIRST_LINE + LATER_LINE],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'log', from: 'prompts/s2.jsonl', to: 'sessions/2026-12/02T08-30-00Z_s2.jsonl' },
      { kind: 'removal', path: 'prompts' },
    ],
    left: [],
  });
});

test('changes nothing while it finds the moves of the logs', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
  ]);

  findLogMoves(projectRoot);

  assert.deepEqual(
    readdirSync(join(projectRoot, '.yapus'), { recursive: true }).sort(),
    ['prompts', 'prompts/.gitignore', 'prompts/s1.jsonl'],
  );
});

test('passes the lines without a time in the ISO form on the way to the first time', (t) => {
  const lines = [
    'not JSON',
    '[]',
    '{"prompt":"no time"}',
    '{"time":20261101,"prompt":"a number"}',
    '{"time":"2026-11-01 09:00","prompt":"another form"}',
    '{"time":"2026-11-01T09:00:00Z","prompt":"no milliseconds"}',
    '{"time":"never","prompt":"no time at all"}',
  ];
  const log = `${ lines.join('\n') }\n${ FIRST_LINE }`;
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', log]]);

  assert.deepEqual(findLogMoves(projectRoot).moves.at(0), {
    kind: 'log',
    from: 'prompts/s1.jsonl',
    to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl',
  });
});

test('takes the time of a plan line for the first time as well', (t) => {
  const planLine = '{"time":"2026-10-31T23:59:59.999Z","plan":"2026-10/topic","file":"S1.md"}\n';
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', planLine + FIRST_LINE]]);

  assert.deepEqual(findLogMoves(projectRoot).moves.at(0), {
    kind: 'log',
    from: 'prompts/s1.jsonl',
    to: 'sessions/2026-10/31T23-59-59Z_s1.jsonl',
  });
});

test('leaves a log without a time and keeps the directory', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/s1.jsonl', FIRST_LINE],
    ['prompts/s2.jsonl', '{"prompt":"go"}\n'],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
    ],
    left: [
      {
        path: 'prompts/s2.jsonl',
        reason: 'no line carries a time; move or remove it by hand',
      },
    ],
  });
});

test('leaves a log whose session has a file in any month and names that file', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/s1.jsonl', FIRST_LINE],
    ['sessions/.gitignore', '*\n'],
    ['sessions/2026-12/02T08-30-00Z_s1.jsonl', LATER_LINE],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [],
    left: [
      {
        path: 'prompts/s1.jsonl',
        reason: 'the session already has sessions/2026-12/02T08-30-00Z_s1.jsonl; '
          + 'merge or remove one by hand',
      },
    ],
  });
});

test('moves a log beside the file of another session', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/s1.jsonl', FIRST_LINE],
    ['sessions/.gitignore', '*\n'],
    ['sessions/2026-11/15T10-00-00Z_xs1.jsonl', FIRST_LINE],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'removal', path: 'prompts' },
    ],
    left: [],
  });
});

test('leaves a file with another ending, a name that is no id and a directory', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/notes.txt', 'a note\n'],
    ['prompts/a_b.jsonl', FIRST_LINE],
    ['prompts/s3.jsonl/', ''],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [],
    left: [
      { path: 'prompts/a_b.jsonl', reason: NO_LOG },
      { path: 'prompts/notes.txt', reason: NO_LOG },
      { path: 'prompts/s3.jsonl', reason: NO_LOG },
    ],
  });
});

test('moves the ignore file before the logs when the sessions directory has none', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '!*.jsonl\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
    ['sessions/2026-10/', ''],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [
      { kind: 'ignore', from: 'prompts/.gitignore', to: 'sessions/.gitignore' },
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'removal', path: 'prompts' },
    ],
    left: [],
  });
});

test('keeps an ignore file the sessions directory lacks in place while a log is left', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '!*.jsonl\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
    ['prompts/s2.jsonl', '{"prompt":"go"}\n'],
  ]);

  assert.deepEqual(findLogMoves(projectRoot).moves, [
    { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
  ]);
});

test('keeps an ignore file with the bytes of the present one while an entry is left', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['prompts/notes.txt', 'a note\n'],
    ['sessions/.gitignore', '*\n'],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [],
    left: [{ path: 'prompts/notes.txt', reason: NO_LOG }],
  });
});

test('names a left log alone beside an ignore file that differs from the present one', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '!*.jsonl\n'],
    ['prompts/s1.jsonl', '{"prompt":"go"}\n'],
    ['sessions/.gitignore', '*\n'],
  ]);

  assert.deepEqual(findLogMoves(projectRoot).left.map(({ path }) => path), ['prompts/s1.jsonl']);
});

test('removes the ignore file after the logs when the present one holds its bytes', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
    ['sessions/.gitignore', '*\n'],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'removal', path: 'prompts/.gitignore' },
      { kind: 'removal', path: 'prompts' },
    ],
    left: [],
  });
});

test('leaves an ignore file that differs from the present one and keeps the directory', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n# kept\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
    ['sessions/.gitignore', '*\n'],
  ]);

  assert.deepEqual(findLogMoves(projectRoot), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
    ],
    left: [
      {
        path: 'prompts/.gitignore',
        reason: 'it differs from sessions/.gitignore; keep one by hand',
      },
    ],
  });
});

test('leaves an ignore file it cannot compare with the present one', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/.gitignore', '*\n'],
    ['sessions/.gitignore/', ''],
  ]);
  const [left, ...others] = findLogMoves(projectRoot).left;

  assert.deepEqual([left?.path, others], ['prompts/.gitignore', []]);
  assert.match(
    left?.reason ?? '',
    /^it cannot be compared with sessions\/\.gitignore: EISDIR[^\n]*; make both readable$/u,
  );
});

test('leaves the older directory when it cannot be read', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', FIRST_LINE]]);
  const oldDirectory = join(projectRoot, '.yapus', 'prompts');

  chmodSync(oldDirectory, 0o000);

  const found = findLogMoves(projectRoot);

  chmodSync(oldDirectory, 0o700);

  assert.deepEqual([found.moves, found.left.map(({ path }) => path)], [[], ['prompts']]);
  assert.match(
    found.left.at(0)?.reason ?? '',
    /^it cannot be read: EACCES[^\n]*; make it readable$/u,
  );
});

test('leaves a log it cannot read', (t) => {
  const projectRoot = makeProject(t, [['prompts/s1.jsonl', FIRST_LINE]]);
  const logPath = join(projectRoot, '.yapus', 'prompts', 's1.jsonl');

  chmodSync(logPath, 0o000);

  const found = findLogMoves(projectRoot);

  chmodSync(logPath, 0o600);

  assert.deepEqual([found.moves, found.left.map(({ path }) => path)], [[], ['prompts/s1.jsonl']]);
  assert.match(
    found.left.at(0)?.reason ?? '',
    /^it cannot be read: EACCES[^\n]*; make it readable$/u,
  );
});

test('leaves a log when a month of the sessions directory cannot be read', (t) => {
  const projectRoot = makeProject(t, [
    ['prompts/s1.jsonl', FIRST_LINE],
    ['sessions/.gitignore', '*\n'],
    ['sessions/2026-11/', ''],
  ]);
  const monthDirectory = join(projectRoot, '.yapus', 'sessions', '2026-11');

  chmodSync(monthDirectory, 0o000);

  const found = findLogMoves(projectRoot);

  chmodSync(monthDirectory, 0o700);

  assert.deepEqual([found.moves, found.left.map(({ path }) => path)], [[], ['prompts/s1.jsonl']]);
  assert.match(found.left.at(0)?.reason ?? '', /^cannot read [^\n]*2026-11: EACCES/u);
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
