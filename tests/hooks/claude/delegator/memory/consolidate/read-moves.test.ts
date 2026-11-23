import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  getMovesPath,
  type ReadMoves,
  readMoves,
} from '../../../../../../hooks/claude/delegator/memory/consolidate/read-moves.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import type { TempFile } from '../../../../../helpers/make-temp-repo.ts';

const AUTO_FILES: readonly TempFile[] = [
  { path: 'MEMORY.md', text: '- [A](a.md): a\n' },
  { path: 'a.md', text: '---\ndescription: The a\n---\na\n' },
  { path: 'b.md', text: '---\ndescription: The b\n---\nb\n' },
  { path: 'c.md', text: '---\ndescription: The c\n---\nc\n' },
];
const NO_STEP_MADE = 'no step made';
const NO_FORM = 'which is not <work|rules|reference>/<name>.md with a name of lowercase letters, '
  + `digits and hyphens; write it in that form, ${ NO_STEP_MADE }`;

interface Migration {
  readonly projectRoot: string;
  readonly configDirectory: string;
  readonly autoDirectory: string;
}

test('names the moves file migration.json in the memory directory of the project', () => {
  assert.equal(getMovesPath('/p'), '/p/.yapus/memory/migration.json');
});

test('gives none for a project with no moves file', (t) => {
  const { configDirectory } = makeAutoMemory(t, AUTO_FILES);

  assert.deepEqual(readMoves(makeMemoryProject(t, []), configDirectory), { kind: 'none' });
});

test('gives none for a project with no memory directory', (t) => {
  const { configDirectory } = makeAutoMemory(t, AUTO_FILES);

  assert.deepEqual(readMoves(makeTempDir(t), configDirectory), { kind: 'none' });
});

test('reads a move and a removal in their order and the files no step names as kept', (t) => {
  const migration = makeMigration(t, [
    { move: 'b.md', to: 'rules/b-rule-2.md' },
    { remove: 'a.md' },
  ]);

  assert.deepEqual(read(migration), {
    kind: 'moves',
    moves: {
      autoDirectory: migration.autoDirectory,
      steps: [
        { kind: 'move', file: 'b.md', directory: 'rules', name: 'b-rule-2' },
        { kind: 'remove', file: 'a.md' },
      ],
      made: [],
      kept: ['c.md'],
    },
  });
});

test('reads a moves file with no step and keeps every topic file, by name', (t) => {
  const migration = makeMigration(t, []);

  assert.deepEqual(read(migration), {
    kind: 'moves',
    moves: {
      autoDirectory: migration.autoDirectory,
      steps: [],
      made: [],
      kept: ['a.md', 'b.md', 'c.md'],
    },
  });
});

test('reads a target in each of the three directories', (t) => {
  const moves = getSteps(read(makeMigration(t, [
    { move: 'a.md', to: 'work/a.md' },
    { move: 'b.md', to: 'rules/b.md' },
    { move: 'c.md', to: 'reference/c.md' },
  ])));

  assert.deepEqual(moves, [
    { kind: 'move', file: 'a.md', directory: 'work', name: 'a' },
    { kind: 'move', file: 'b.md', directory: 'rules', name: 'b' },
    { kind: 'move', file: 'c.md', directory: 'reference', name: 'c' },
  ]);
});

test('reads a step that carries another key', (t) => {
  const steps = getSteps(read(makeMigration(t, [{ remove: 'a.md', why: 'git shows it' }])));

  assert.deepEqual(steps, [{ kind: 'remove', file: 'a.md' }]);
});

test('keeps no index, no file of another ending, no directory and no link', (t) => {
  const migration = makeMigration(t, []);

  writeFileSync(join(migration.autoDirectory, 'notes.txt'), 'a note\n');
  mkdirSync(join(migration.autoDirectory, 'folder.md'));
  symlinkSync(join(migration.autoDirectory, 'a.md'), join(migration.autoDirectory, 'link.md'));

  assert.deepEqual(getKept(read(migration)), ['a.md', 'b.md', 'c.md']);
});

test('gives the auto memory directory a path with a parent step leads to', (t) => {
  const auto = makeAutoMemory(t, AUTO_FILES);
  const projectRoot = makeProject(t, {
    memoryDirectory: `${ auto.memoryDirectory }/../memory/`,
    steps: [],
  });
  const found = readMoves(projectRoot, auto.configDirectory);

  assert.ok(found.kind === 'moves');
  assert.equal(found.moves.autoDirectory, auto.memoryDirectory);
});

test('fails on a moves file that is not JSON', (t) => {
  const { configDirectory } = makeAutoMemory(t, AUTO_FILES);
  const projectRoot = makeMemoryProject(t, [{ path: 'migration.json', text: '{ "steps": [' }]);

  assert.match(
    getDetails(readMoves(projectRoot, configDirectory)).join('\n'),
    /^.*\.yapus\/memory\/migration\.json is not JSON: [^\n]+; write it as JSON, no step made$/u,
  );
});

test('fails on a moves file that is a list, has no memoryDirectory text or no steps list', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, AUTO_FILES);
  const list = makeProject(t, []);
  const noDirectory = makeProject(t, { memoryDirectory: 1, steps: [] });
  const noSteps = makeProject(t, { memoryDirectory, steps: {} });
  const failed = 'is not an object with a memoryDirectory text and a steps list; give it both, '
    + 'no step made';

  assert.deepEqual(
    [
      readMoves(list, configDirectory),
      readMoves(noDirectory, configDirectory),
      readMoves(noSteps, configDirectory),
    ],
    [
      { kind: 'failure', details: [`${ getMovesPath(list) } ${ failed }`] },
      { kind: 'failure', details: [`${ getMovesPath(noDirectory) } ${ failed }`] },
      { kind: 'failure', details: [`${ getMovesPath(noSteps) } ${ failed }`] },
    ],
  );
});

test('fails on a moves file that cannot be read as a file', (t) => {
  const { configDirectory } = makeAutoMemory(t, AUTO_FILES);
  const projectRoot = makeMemoryProject(t, []);

  mkdirSync(getMovesPath(projectRoot));

  assert.match(
    getDetails(readMoves(projectRoot, configDirectory)).join('\n'),
    /^cannot read .*migration\.json: EISDIR[^\n]*; make it a file, no step made$/u,
  );
});

test('names each step that is neither a move nor a removal, by its number', (t) => {
  const migration = makeMigration(t, [
    { remove: 'a.md' },
    { move: 'b.md' },
    'c.md',
    { move: 'b.md', to: 'rules/b.md', remove: 'b.md' },
    { remove: 'c.md', to: 'rules/c.md' },
  ]);
  const movesPath = getMovesPath(migration.projectRoot);
  const neither = `of ${ movesPath } is neither { "move": "<file>", "to": "<directory>/<name>.md" `
    + `} nor { "remove": "<file>" }; write it as one of the two, ${ NO_STEP_MADE }`;

  assert.deepEqual(getDetails(read(migration)), [
    `step 2 ${ neither }`,
    `step 3 ${ neither }`,
    `step 4 ${ neither }`,
    `step 5 ${ neither }`,
  ]);
});

test('fails on a memoryDirectory that is no auto memory directory of the configuration', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, AUTO_FILES);
  const elsewhere = join(makeTempDir(t), 'projects', '-work-app', 'memory');
  const deeper = join(memoryDirectory, 'deeper');
  const failed = 'is no auto memory directory, <config>/projects/<slug>/memory; '
    + `name the one of this project, ${ NO_STEP_MADE }`;

  assert.deepEqual(
    [
      readMoves(makeProject(t, { memoryDirectory: elsewhere, steps: [] }), configDirectory),
      readMoves(makeProject(t, { memoryDirectory: deeper, steps: [] }), configDirectory),
      readMoves(makeProject(t, { memoryDirectory: 'memory', steps: [] }), configDirectory),
    ],
    [
      { kind: 'failure', details: [`memoryDirectory ${ elsewhere } ${ failed }`] },
      { kind: 'failure', details: [`memoryDirectory ${ deeper } ${ failed }`] },
      { kind: 'failure', details: [`memoryDirectory memory ${ failed }`] },
    ],
  );
});

test('fails on every memoryDirectory when no configuration directory is known', (t) => {
  const { memoryDirectory } = makeAutoMemory(t, AUTO_FILES);
  const projectRoot = makeProject(t, { memoryDirectory, steps: [] });

  assert.deepEqual(readMoves(projectRoot, undefined), {
    kind: 'failure',
    details: [
      `memoryDirectory ${ memoryDirectory } is no auto memory directory, `
      + `<config>/projects/<slug>/memory; name the one of this project, ${ NO_STEP_MADE }`,
    ],
  });
});

test('fails on an auto memory directory that holds no index', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, [{ path: 'a.md', text: 'a\n' }]);
  const projectRoot = makeProject(t, { memoryDirectory, steps: [{ remove: 'a.md' }] });

  assert.deepEqual(readMoves(projectRoot, configDirectory), {
    kind: 'failure',
    details: [
      `${ memoryDirectory } holds no MEMORY.md; name the auto memory directory that holds the `
      + `index of this project, ${ NO_STEP_MADE }`,
    ],
  });
});

// The backup would hold the link, and the index lines would be taken out of
// the file it leads to.
test('fails on an index that is a link', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, [
    { path: 'index.md', text: '- [A](a.md): a\n' },
    { path: 'a.md', text: 'a\n' },
  ]);
  const projectRoot = makeProject(t, { memoryDirectory, steps: [{ remove: 'a.md' }] });

  symlinkSync(join(memoryDirectory, 'index.md'), join(memoryDirectory, 'MEMORY.md'));

  assert.deepEqual(readMoves(projectRoot, configDirectory), {
    kind: 'failure',
    details: [
      `${ memoryDirectory } holds no MEMORY.md; name the auto memory directory that holds the `
      + `index of this project, ${ NO_STEP_MADE }`,
    ],
  });
});

test('fails on a file that two steps name', (t) => {
  const migration = makeMigration(t, [
    { move: 'a.md', to: 'rules/a.md' },
    { remove: 'b.md' },
    { remove: 'a.md' },
  ]);

  assert.deepEqual(getDetails(read(migration)), [
    `step 3 names a.md, which step 1 names too; name each file in one step, ${ NO_STEP_MADE }`,
  ]);
});

test('fails on a file that is no topic file directly in the auto memory directory', (t) => {
  const migration = makeMigration(t, [
    { move: 'gone.md', to: 'rules/gone.md' },
    { remove: 'MEMORY.md' },
    { remove: '../memory/a.md' },
    { remove: 'notes.txt' },
  ]);
  const failed = `which is no topic file in ${ migration.autoDirectory }; `
    + `name a file that is there, ${ NO_STEP_MADE }`;

  writeFileSync(join(migration.autoDirectory, 'notes.txt'), 'a note\n');

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 names gone.md, ${ failed }`,
    `step 2 names MEMORY.md, ${ failed }`,
    `step 3 names ../memory/a.md, ${ failed }`,
    `step 4 names notes.txt, ${ failed }`,
  ]);
});

test('fails on a removal of a file that is gone and is named as no topic file', (t) => {
  const migration = makeMigration(t, [
    { remove: 'gone.txt' },
    { remove: '../memory/gone.md' },
    { remove: 'deeper/gone.md' },
  ]);
  const failed = `which is no topic file in ${ migration.autoDirectory }; `
    + `name a file that is there, ${ NO_STEP_MADE }`;

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 names gone.txt, ${ failed }`,
    `step 2 names ../memory/gone.md, ${ failed }`,
    `step 3 names deeper/gone.md, ${ failed }`,
  ]);
});

test('reads a move whose file is gone and whose target is there as made before', (t) => {
  const migration = makeMigration(
    t,
    [{ move: 'gone.md', to: 'rules/gone-rule.md' }, { move: 'a.md', to: 'rules/a.md' }],
    [{ path: 'rules/gone-rule.md', text: 'moved by the run before\n' }],
  );

  assert.deepEqual(read(migration), {
    kind: 'moves',
    moves: {
      autoDirectory: migration.autoDirectory,
      steps: [{ kind: 'move', file: 'a.md', directory: 'rules', name: 'a' }],
      made: [{ kind: 'move', file: 'gone.md', directory: 'rules', name: 'gone-rule' }],
      kept: ['b.md', 'c.md'],
    },
  });
});

test('reads a removal whose file is gone as made before', (t) => {
  const migration = makeMigration(t, [{ remove: 'gone.md' }, { remove: 'b.md' }]);

  assert.deepEqual(read(migration), {
    kind: 'moves',
    moves: {
      autoDirectory: migration.autoDirectory,
      steps: [{ kind: 'remove', file: 'b.md' }],
      made: [{ kind: 'remove', file: 'gone.md' }],
      kept: ['a.md', 'c.md'],
    },
  });
});

test('fails on a file that is gone when two steps name it', (t) => {
  const migration = makeMigration(t, [{ remove: 'gone.md' }, { remove: 'gone.md' }]);

  assert.deepEqual(getDetails(read(migration)), [
    `step 2 names gone.md, which step 1 names too; name each file in one step, ${ NO_STEP_MADE }`,
  ]);
});

test('fails on a move of a file that holds no one-line description in its frontmatter', (t) => {
  const migration = makeMigration(t, [
    { move: 'bare.md', to: 'rules/bare.md' },
    { move: 'folded.md', to: 'rules/folded.md' },
    { move: 'crlf.md', to: 'rules/crlf.md' },
    { move: 'a.md', to: 'rules/a.md' },
  ]);
  const failed = `which has no one-line description in its frontmatter; give it one, ${
    NO_STEP_MADE }`;

  writeFileSync(join(migration.autoDirectory, 'bare.md'), 'No frontmatter.\n');
  writeFileSync(
    join(migration.autoDirectory, 'folded.md'),
    '---\ndescription: >-\n  The folded rule,\n  on two lines\n---\nFolded.\n',
  );
  writeFileSync(
    join(migration.autoDirectory, 'crlf.md'),
    '---\r\ndescription: The rule\r\n---\r\nWith CRLF.\r\n',
  );

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 moves bare.md, ${ failed }`,
    `step 2 moves folded.md, ${ failed }`,
    `step 3 moves crlf.md, ${ failed }`,
  ]);
});

test('reads a removal of a file that holds no description', (t) => {
  const migration = makeMigration(t, [{ remove: 'bare.md' }]);

  writeFileSync(join(migration.autoDirectory, 'bare.md'), 'No frontmatter.\n');

  assert.deepEqual(getSteps(read(migration)), [{ kind: 'remove', file: 'bare.md' }]);
});

test('fails on a target outside the three directories', (t) => {
  const migration = makeMigration(t, [
    { move: 'a.md', to: 'lessons/a.md' },
    { move: 'b.md', to: 'b.md' },
    { move: 'c.md', to: '../rules/c.md' },
  ]);

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 moves a.md to lessons/a.md, ${ NO_FORM }`,
    `step 2 moves b.md to b.md, ${ NO_FORM }`,
    `step 3 moves c.md to ../rules/c.md, ${ NO_FORM }`,
  ]);
});

test('fails on a target whose name is of another form', (t) => {
  const migration = makeMigration(t, [
    { move: 'a.md', to: 'rules/A.md' },
    { move: 'b.md', to: 'rules/b_rule.md' },
    { move: 'c.md', to: 'rules/deeper/c.md' },
  ]);

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 moves a.md to rules/A.md, ${ NO_FORM }`,
    `step 2 moves b.md to rules/b_rule.md, ${ NO_FORM }`,
    `step 3 moves c.md to rules/deeper/c.md, ${ NO_FORM }`,
  ]);
});

test('fails on a target with no name or of another ending', (t) => {
  const migration = makeMigration(t, [
    { move: 'a.md', to: 'rules/.md' },
    { move: 'b.md', to: 'rules/b' },
    { move: 'c.md', to: 'rules/c.txt' },
  ]);

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 moves a.md to rules/.md, ${ NO_FORM }`,
    `step 2 moves b.md to rules/b, ${ NO_FORM }`,
    `step 3 moves c.md to rules/c.txt, ${ NO_FORM }`,
  ]);
});

test('fails on a target that is in the memory directory already', (t) => {
  const migration = makeMigration(
    t,
    [{ move: 'a.md', to: 'rules/a.md' }, { move: 'b.md', to: 'rules/b.md' }],
    [{ path: 'rules/a.md', text: 'a rule\n' }],
  );
  const memoryDirectory = join(migration.projectRoot, '.yapus', 'memory');

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 moves a.md to rules/a.md, which exists in ${ memoryDirectory }; `
    + `choose another name or remove that file, ${ NO_STEP_MADE }`,
  ]);
});

test('fails on a target that is a link leading nowhere', (t) => {
  const migration = makeMigration(t, [{ move: 'a.md', to: 'rules/a.md' }]);
  const memoryDirectory = join(migration.projectRoot, '.yapus', 'memory');

  mkdirSync(join(memoryDirectory, 'rules'));
  symlinkSync(join(memoryDirectory, 'gone.md'), join(memoryDirectory, 'rules', 'a.md'));

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 moves a.md to rules/a.md, which exists in ${ memoryDirectory }; `
    + `choose another name or remove that file, ${ NO_STEP_MADE }`,
  ]);
});

test('fails on a target that two steps name', (t) => {
  const migration = makeMigration(t, [
    { move: 'a.md', to: 'rules/x.md' },
    { move: 'b.md', to: 'rules/x.md' },
  ]);

  assert.deepEqual(getDetails(read(migration)), [
    'step 2 moves b.md to rules/x.md, the target of step 1 too; give each file its own target, '
    + 'no step made',
  ]);
});

test('gives one line for each failure of each step, in the order of the steps', (t) => {
  const migration = makeMigration(t, [
    { move: 'gone.md', to: 'lessons/gone.md' },
    { remove: 'a.md' },
    { remove: 'a.md' },
  ]);

  assert.deepEqual(getDetails(read(migration)), [
    `step 1 names gone.md, which is no topic file in ${ migration.autoDirectory }; `
    + `name a file that is there, ${ NO_STEP_MADE }`,
    `step 1 moves gone.md to lessons/gone.md, ${ NO_FORM }`,
    `step 3 names a.md, which step 2 names too; name each file in one step, ${ NO_STEP_MADE }`,
  ]);
});

// An auto memory with the index and three topic files, and a project whose
// moves file names that directory and holds the steps.
function makeMigration(
  t: TestContext,
  steps: readonly unknown[],
  memoryFiles: readonly TempFile[] = [],
): Migration {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, AUTO_FILES);
  const projectRoot = makeMemoryProject(t, [
    ...memoryFiles,
    { path: 'migration.json', text: JSON.stringify({ memoryDirectory, steps }) },
  ]);

  return { projectRoot, configDirectory, autoDirectory: memoryDirectory };
}

// A project whose moves file holds the JSON of the given value.
function makeProject(t: TestContext, moves: unknown): string {
  return makeMemoryProject(t, [{ path: 'migration.json', text: JSON.stringify(moves) }]);
}

function read({ projectRoot, configDirectory }: Migration): ReadMoves {
  return readMoves(projectRoot, configDirectory);
}

// The steps of a moves file that was read; none for one that was not.
function getSteps(found: ReadMoves): readonly unknown[] {
  return found.kind === 'moves' ? found.moves.steps : [];
}

function getKept(found: ReadMoves): readonly string[] {
  return found.kind === 'moves' ? found.moves.kept : [];
}

// The lines of a failure; none for a moves file that was read.
function getDetails(found: ReadMoves): readonly string[] {
  return found.kind === 'failure' ? found.details : [];
}
