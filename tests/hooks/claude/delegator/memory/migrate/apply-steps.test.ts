import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  applySteps,
  findBackup,
} from '../../../../../../hooks/claude/delegator/memory/migrate/apply-steps.ts';
import type {
  Step,
} from '../../../../../../hooks/claude/delegator/memory/migrate/read-moves.ts';
import { readEntries } from '../../../../../../hooks/claude/delegator/memory/read-entries.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';
import type { TempFile } from '../../../../../helpers/make-temp-repo.ts';
import { readTree } from './read-tree.ts';

const TIME = new Date('2026-11-23T14:05:09.123Z');
const STAMP = '2026-11-23T14-05-09Z';
const MOVES_TEXT = '{ "the moves": "as they were written" }\n';
const INDEX_TEXT = '- [A](a.md): the a\n- [B](b.md) - the b\n- [C](c.md): the c\n';

// A topic file as Claude Code stores it.
const STORED_TEXT = [
  '---',
  'name: a',
  'description: The a rule, for a calls',
  'metadata:',
  '  node_type: memory',
  '  type: feedback',
  '  description: not this one',
  '---',
  '',
  'Do a.',
  '',
  '**Why:** it was asked.',
  '',
].join('\n');
const AUTO_FILES: readonly TempFile[] = [
  { path: 'MEMORY.md', text: INDEX_TEXT },
  { path: 'a.md', text: STORED_TEXT },
  { path: 'b.md', text: 'b\n' },
  { path: 'c.md', text: 'c\n' },
];
const MOVE_A = { kind: 'move', file: 'a.md', directory: 'rules', name: 'a-rule' } as const;
const REMOVE_B = { kind: 'remove', file: 'b.md' } as const;
const REMOVE_C = { kind: 'remove', file: 'c.md' } as const;
const AFTER_FAILURE = 'no step after it is made; repair it and run the command again';

interface Migration {
  readonly projectRoot: string;
  readonly memoryDirectory: string;
  readonly autoDirectory: string;
  readonly backupDirectory: string;
}

test('names the backup by the UTC time of the run, in memory-backup beside the directory', () => {
  assert.deepEqual(findBackup('/c/projects/-work-app/memory', TIME), {
    kind: 'free',
    directory: `/c/projects/-work-app/memory-backup/${ STAMP }`,
  });
});

test('fails on a backup directory that exists', (t) => {
  const { autoDirectory, backupDirectory } = makeMigration(t, AUTO_FILES);

  mkdirSync(backupDirectory, { recursive: true });

  assert.deepEqual(findBackup(autoDirectory, TIME), {
    kind: 'failure',
    detail: `the backup directory ${ backupDirectory } exists; run the command again, `
      + 'no step made',
  });
});

test('copies every file of the auto memory directory to the backup byte for byte', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  writeFileSync(join(migration.autoDirectory, 'bytes.bin'), Buffer.from([0xff, 0x00, 0x0a]));
  mkdirSync(join(migration.autoDirectory, 'deeper'));
  writeFileSync(join(migration.autoDirectory, 'deeper', 'd.md'), 'd\n');

  assert.deepEqual(apply(migration, [MOVE_A, REMOVE_B]), { kind: 'done' });
  assert.deepEqual(readTree(migration.backupDirectory), [
    ['MEMORY.md', INDEX_TEXT],
    ['a.md', STORED_TEXT],
    ['b.md', 'b\n'],
    ['bytes.bin', '\xff\x00\n'],
    ['c.md', 'c\n'],
    ['deeper/d.md', 'd\n'],
    ['migration.json', MOVES_TEXT],
  ]);
});

test('moves a file to its target with its description alone and its body as it was', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  apply(migration, [MOVE_A]);

  assert.deepEqual(
    [
      readFileSync(join(migration.memoryDirectory, 'rules', 'a-rule.md'), 'utf8'),
      existsSync(join(migration.autoDirectory, 'a.md')),
    ],
    [
      '---\ndescription: "The a rule, for a calls"\n---\n\nDo a.\n\n**Why:** it was asked.\n',
      false,
    ],
  );
});

test('writes a description without the quotes that stood around it', (t) => {
  const migration = makeMigration(t, [
    { path: 'MEMORY.md', text: '' },
    { path: 'a.md', text: '---\ndescription: "Say \\"go\\": a\\\\b"\n---\nA.\n' },
    { path: 'b.md', text: "---\ndescription: 'It''s the b'  \n---\nB.\n" },
    { path: 'c.md', text: '---\ndescription: "C" and more\n---\nC.\n' },
  ]);

  apply(migration, [
    { kind: 'move', file: 'a.md', directory: 'rules', name: 'a' },
    { kind: 'move', file: 'b.md', directory: 'rules', name: 'b' },
    { kind: 'move', file: 'c.md', directory: 'rules', name: 'c' },
  ]);

  assert.deepEqual(readTree(join(migration.memoryDirectory, 'rules')), [
    ['a.md', '---\ndescription: "Say "go": a\\b"\n---\nA.\n'],
    ['b.md', '---\ndescription: "It\'s the b"\n---\nB.\n'],
    ['c.md', '---\ndescription: ""C" and more"\n---\nC.\n'],
  ]);
});

test('writes a description the reader of the project memory gives back as it was', (t) => {
  const migration = makeMigration(t, [
    { path: 'MEMORY.md', text: '' },
    { path: 'a.md', text: '---\ndescription: Say "go" and "stop"\n---\nA.\n' },
  ]);

  apply(migration, [{ kind: 'move', file: 'a.md', directory: 'reference', name: 'a' }]);

  const { entries, problems } = readEntries(migration.projectRoot);

  assert.deepEqual(
    [entries.map(({ path, description, body }) => [path, description, body]), problems],
    [[['.yapus/memory/reference/a.md', 'Say "go" and "stop"', 'A.\n']], []],
  );
});

test('writes an empty description for a file that has none and keeps its whole text', (t) => {
  const migration = makeMigration(t, [
    { path: 'MEMORY.md', text: '' },
    { path: 'a.md', text: 'No frontmatter.\n---\ndescription: in the body\n' },
    { path: 'b.md', text: '---\nname: b\n---\nB.\n' },
  ]);

  apply(migration, [
    { kind: 'move', file: 'a.md', directory: 'work', name: 'a' },
    { kind: 'move', file: 'b.md', directory: 'work', name: 'b' },
  ]);

  assert.deepEqual(readTree(join(migration.memoryDirectory, 'work')), [
    ['a.md', '---\ndescription: ""\n---\nNo frontmatter.\n---\ndescription: in the body\n'],
    ['b.md', '---\ndescription: ""\n---\nB.\n'],
  ]);
});

test('deletes a removed file and writes nothing to the project memory', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  assert.deepEqual(apply(migration, [REMOVE_B]), { kind: 'done' });
  assert.deepEqual(
    [readdirSync(migration.autoDirectory).sort(), readTree(migration.memoryDirectory)],
    [['MEMORY.md', 'a.md', 'c.md'], []],
  );
});

test('makes no step that a run before this one made', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  assert.deepEqual(apply(migration, [REMOVE_B], [MOVE_A, REMOVE_C]), { kind: 'done' });
  assert.deepEqual(
    [readdirSync(migration.autoDirectory).sort(), readTree(migration.memoryDirectory)],
    [['MEMORY.md', 'a.md', 'c.md'], []],
  );
});

test('takes the lines that link a moved or removed file out of the index', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  apply(migration, [MOVE_A, REMOVE_B]);

  assert.equal(
    readFileSync(join(migration.autoDirectory, 'MEMORY.md'), 'utf8'),
    '- [C](c.md): the c\n',
  );
});

test('takes out the lines that link the file with ./ before it or with a title', (t) => {
  const migration = makeMigration(t, [
    { path: 'MEMORY.md', text: '- [A](./a.md): the a\n- [B](b.md "the b")\n- [C](c.md): the c\n' },
    { path: 'a.md', text: STORED_TEXT },
    { path: 'b.md', text: 'b\n' },
    { path: 'c.md', text: 'c\n' },
  ]);

  apply(migration, [MOVE_A, REMOVE_B]);

  assert.equal(
    readFileSync(join(migration.autoDirectory, 'MEMORY.md'), 'utf8'),
    '- [C](c.md): the c\n',
  );
});

test('leaves every line that does not link the file byte for byte', (t) => {
  const indexText = [
    '# Memory\r',
    '',
    '- [B](b.md): the b, see [A](a.md)',
    '- a.md is named here without a link',
    '- [A site](https://example.invalid/a.md) and [deeper](deeper/a.md)',
    '- [C](c.md)  - the c  ',
    '- [A](a.md) - the a',
    '- [A again](a.md)',
    'no newline at the end',
  ].join('\n');
  const migration = makeMigration(t, [
    { path: 'MEMORY.md', text: indexText },
    { path: 'a.md', text: STORED_TEXT },
  ]);

  apply(migration, [MOVE_A]);

  assert.equal(
    readFileSync(join(migration.autoDirectory, 'MEMORY.md'), 'utf8'),
    [
      '# Memory\r',
      '',
      '- a.md is named here without a link',
      '- [A site](https://example.invalid/a.md) and [deeper](deeper/a.md)',
      '- [C](c.md)  - the c  ',
      'no newline at the end',
    ].join('\n'),
  );
});

test('moves the moves file into the backup', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  apply(migration, []);

  assert.deepEqual(
    [
      existsSync(join(migration.memoryDirectory, 'migration.json')),
      readFileSync(join(migration.backupDirectory, 'migration.json'), 'utf8'),
    ],
    [false, MOVES_TEXT],
  );
});

// The target appeared after the moves file was checked.
test('fails on a target that exists and replaces nothing', (t) => {
  const migration = makeMigration(t, AUTO_FILES, [{ path: 'rules/a-rule.md', text: 'kept\n' }]);
  const applied = apply(migration, [MOVE_A]);

  assert.ok(applied.kind === 'failure');
  assert.match(
    applied.detail,
    /^a\.md -> rules\/a-rule\.md failed: EEXIST[^\n]*; no step after it is made; repair it and run the command again$/u,
  );
  assert.deepEqual(
    [
      readFileSync(join(migration.memoryDirectory, 'rules', 'a-rule.md'), 'utf8'),
      readFileSync(join(migration.autoDirectory, 'a.md'), 'utf8'),
      readFileSync(join(migration.autoDirectory, 'MEMORY.md'), 'utf8'),
    ],
    ['kept\n', STORED_TEXT, INDEX_TEXT],
  );
});

test('stops at the first step that fails and keeps the steps made before it', (t) => {
  const migration = makeMigration(t, AUTO_FILES, [{ path: 'rules/a-rule.md', text: 'kept\n' }]);
  const applied = apply(migration, [REMOVE_B, MOVE_A, REMOVE_C]);

  assert.equal(applied.kind, 'failure');
  assert.deepEqual(
    [
      readdirSync(migration.autoDirectory).sort(),
      readFileSync(join(migration.autoDirectory, 'MEMORY.md'), 'utf8'),
      existsSync(join(migration.memoryDirectory, 'migration.json')),
    ],
    [['MEMORY.md', 'a.md', 'c.md'], '- [A](a.md): the a\n- [C](c.md): the c\n', true],
  );
});

// The directory appeared after it was found free.
test('fails with the line of the backup when its directory exists and makes no step', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  mkdirSync(migration.backupDirectory, { recursive: true });

  const applied = apply(migration, [REMOVE_B]);

  assert.ok(applied.kind === 'failure');
  assert.equal(
    applied.detail.startsWith(
      `backup: ${ migration.autoDirectory } -> ${ migration.backupDirectory } failed: EEXIST`,
    ),
    true,
  );
  assert.equal(applied.detail.endsWith(`; ${ AFTER_FAILURE }`), true);
  assert.deepEqual(
    [readdirSync(migration.backupDirectory), existsSync(join(migration.autoDirectory, 'b.md'))],
    [[], true],
  );
});

test('fails with the line of the moves file when it cannot be moved into the backup', (t) => {
  const migration = makeMigration(t, AUTO_FILES);

  writeFileSync(join(migration.autoDirectory, 'migration.json'), 'a file of that name\n');

  const applied = apply(migration, []);
  const movesPath = join(migration.memoryDirectory, 'migration.json');

  assert.ok(applied.kind === 'failure');
  assert.equal(
    applied.detail.startsWith(
      `${ movesPath } -> ${ join(migration.backupDirectory, 'migration.json') } failed: EEXIST`,
    ),
    true,
  );
  assert.equal(readFileSync(movesPath, 'utf8'), MOVES_TEXT);
});

// An auto memory holding the files, and a project whose memory directory
// holds a moves file, the three directories and the given files.
function makeMigration(
  t: TestContext,
  autoFiles: readonly TempFile[],
  memoryFiles: readonly TempFile[] = [],
): Migration {
  const { memoryDirectory: autoDirectory } = makeAutoMemory(t, autoFiles);
  const projectRoot = makeMemoryProject(t, [
    ...memoryFiles,
    { path: 'migration.json', text: MOVES_TEXT },
  ]);
  const memoryDirectory = join(projectRoot, '.yapus', 'memory');

  mkdirSync(join(memoryDirectory, 'work'), { recursive: true });
  mkdirSync(join(memoryDirectory, 'rules'), { recursive: true });
  mkdirSync(join(memoryDirectory, 'reference'), { recursive: true });

  return {
    projectRoot,
    memoryDirectory,
    autoDirectory,
    backupDirectory: join(dirname(autoDirectory), 'memory-backup', STAMP),
  };
}

function apply(migration: Migration, steps: readonly Step[], made: readonly Step[] = []) {
  const { projectRoot, autoDirectory, backupDirectory } = migration;

  return applySteps(projectRoot, { autoDirectory, steps, made, kept: [] }, backupDirectory);
}
