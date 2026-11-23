import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  readSorting,
} from '../../../../../../hooks/claude/delegator/memory/sorting/read-sorting.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { readTree } from './read-tree.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'hooks');
const RUN_SH = join(HOOKS, 'run.sh');
const HOOK_NAME = 'claude/delegator/memory/migrate';
const SUBPROCESS_TIMEOUT_MS = 10000;
const MILLISECONDS = 1000;
const PROGRAM = 'yapus delegator migrate-memory';
const INDEX_TEXT = '# Memory\n- [A](a.md): the a\n- [B](b.md) - the b\n- [C](c.md): the c\n';

// A topic file as Claude Code stores it.
const STORED_TEXT = [
  '---',
  'name: a',
  'description: The a rule, for a calls',
  'metadata:',
  '  node_type: memory',
  '  type: feedback',
  '---',
  '',
  'Do a.',
  '',
].join('\n');
const MOVED_TEXT = '---\ndescription: "The a rule, for a calls"\n---\n\nDo a.\n';
const STEPS = [{ move: 'a.md', to: 'rules/a-rule.md' }, { remove: 'b.md' }] as const;
const LISTED = 'nothing is changed; the person runs /delegator:migrate-memory apply to make these'
  + ' steps';
const USAGE = `${ PROGRAM }: the arguments are not <project dir> [apply]; give the absolute path`
  + ' of the project and after it nothing or the word apply, nothing changed\n';

interface Migration {
  readonly projectRoot: string;
  readonly configDirectory: string;
  readonly autoDirectory: string;
}

test('creates the memory directory, says so and prints the guide with the order', (t) => {
  const migration = makeBareProject(t);
  const memoryDirectory = join(migration.projectRoot, '.yapus', 'memory');
  const run = runMigrate(t, migration, [migration.projectRoot]);

  assert.deepEqual(
    [run.status, run.stderr, run.stdout],
    [
      0,
      '',
      `created ${ memoryDirectory }, kept out of git by its .gitignore\n${ getGuide(memoryDirectory) }`,
    ],
  );
  assert.deepEqual(
    [readdirSync(memoryDirectory).sort(), readTree(migration.projectRoot)],
    [['.gitignore', 'reference', 'rules', 'work'], [['.yapus/memory/.gitignore', '*\n']]],
  );
});

test('prints the guide alone and changes nothing where the directory is there', (t) => {
  const migration = makeBareProject(t);

  runMigrate(t, migration, [migration.projectRoot]);

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot]);

  assert.deepEqual(
    [run.status, run.stderr, run.stdout],
    [0, '', getGuide(join(migration.projectRoot, '.yapus', 'memory'))],
  );
  assert.deepEqual(readTrees(migration), before);
});

test('leaves an ignore file with other content as it is', (t) => {
  const { configDirectory, memoryDirectory: autoDirectory } = makeAutoMemory(t, []);
  const projectRoot = makeMemoryProject(t, [{ path: '.gitignore', text: '!rules/\n' }]);
  const run = runMigrate(t, { projectRoot, configDirectory, autoDirectory }, [projectRoot]);

  assert.deepEqual(
    [run.status, readTree(projectRoot)],
    [0, [['.yapus/memory/.gitignore', '!rules/\n']]],
  );
});

test('prints every step and every kept file and changes nothing without apply', (t) => {
  const migration = makeMigration(t, STEPS);
  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot]);

  assert.deepEqual(
    [run.status, run.stderr, run.stdout],
    [0, '', `a.md -> rules/a-rule.md\nb.md removed\nc.md kept\n${ LISTED }\n`],
  );
  assert.deepEqual(readTrees(migration), before);
});

test('prints the backup, every step, every kept file and the done line with apply', (t) => {
  const migration = makeMigration(t, STEPS);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);
  const backupDirectory = findBackupDirectory(migration);

  assert.deepEqual(
    [run.status, run.stderr, run.stdout],
    [
      0,
      '',
      `backup: ${ migration.autoDirectory } -> ${ backupDirectory }\n`
      + 'a.md -> rules/a-rule.md\nb.md removed\nc.md kept\n'
      + 'done; give each rule that belongs to a gh command or a launch its event line, and '
      + `delete ${ backupDirectory } once nothing is missing\n`,
    ],
  );
});

test('names the backup by a UTC stamp in memory-backup beside the auto memory', (t) => {
  const migration = makeMigration(t, STEPS);

  runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.match(
    readdirSync(join(dirname(migration.autoDirectory), 'memory-backup')).join('\n'),
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/u,
  );
});

test('holds every file of the auto memory byte for byte and the moves file in the backup', (t) => {
  const migration = makeMigration(t, STEPS);
  const movesText = readFileSync(getMovesPath(migration), 'utf8');

  runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(readTree(findBackupDirectory(migration)), [
    ['MEMORY.md', INDEX_TEXT],
    ['a.md', STORED_TEXT],
    ['b.md', 'b\n'],
    ['bytes.bin', '\xff\x00\n'],
    ['c.md', 'c\n'],
    ['migration.json', movesText],
  ]);
});

test('puts a moved file at its target with its description alone and its body', (t) => {
  const migration = makeMigration(t, STEPS);

  runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(readTree(join(migration.projectRoot, '.yapus', 'memory')), [
    ['.gitignore', '*\n'],
    ['rules/a-rule.md', MOVED_TEXT],
  ]);
});

test('deletes the moved and the removed file and takes their lines out of the index', (t) => {
  const migration = makeMigration(t, STEPS);

  runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(readTree(migration.autoDirectory), [
    ['MEMORY.md', '# Memory\n- [C](c.md): the c\n'],
    ['bytes.bin', '\xff\x00\n'],
    ['c.md', 'c\n'],
  ]);
});

test('prints the guide on a second apply and changes nothing', (t) => {
  const migration = makeMigration(t, STEPS);

  runMigrate(t, migration, [migration.projectRoot, 'apply']);

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(
    [run.status, run.stderr, run.stdout],
    [0, '', getGuide(join(migration.projectRoot, '.yapus', 'memory'))],
  );
  assert.deepEqual(readTrees(migration), before);
});

// A standard output that refuses the write stops the program at the list.
test('changes nothing when the list cannot be printed', (t) => {
  const migration = makeMigration(t, STEPS);
  const before = readTrees(migration);
  const unwritable = openSync(RUN_SH, 'r');

  t.after(() => {
    closeSync(unwritable);
  });

  const run = spawnSync('bash', [RUN_SH, HOOK_NAME, migration.projectRoot, 'apply'], {
    encoding: 'utf8',
    env: makeEnv(t, migration),
    stdio: ['ignore', unwritable, 'pipe'],
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(run.status, 2);
  assert.match(run.stderr, /^yapus delegator migrate-memory: crashed: [^\n]*; fix the program\n$/u);
  assert.deepEqual(readTrees(migration), before);
});

test('refuses a moves file that is not JSON and changes nothing', (t) => {
  const migration = makeMigration(t, STEPS);

  writeFileSync(getMovesPath(migration), '{ "steps": [');

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.match(
    run.stderr,
    /^yapus delegator migrate-memory: .*migration\.json is not JSON: [^\n]+; write it as JSON, nothing changed\n$/u,
  );
  assert.deepEqual(readTrees(migration), before);
});

test('refuses a memoryDirectory outside the configuration directory', (t) => {
  const migration = makeMigration(t, STEPS);
  const elsewhere = join(makeTempDir(t), 'projects', '-work-app', 'memory');

  writeFileSync(
    getMovesPath(migration),
    JSON.stringify({ memoryDirectory: elsewhere, steps: STEPS }),
  );

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: memoryDirectory ${ elsewhere } is no auto memory directory, `
      + '<config>/projects/<slug>/memory; name the one of this project, nothing changed\n',
    ],
  );
  assert.deepEqual(readTrees(migration), before);
});

test('refuses an auto memory directory that holds no index', (t) => {
  const migration = makeMigration(t, STEPS);

  rmSync(join(migration.autoDirectory, 'MEMORY.md'));

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: ${ migration.autoDirectory } holds no MEMORY.md; name the auto memory `
      + 'directory that holds the index of this project, nothing changed\n',
    ],
  );
  assert.deepEqual(readTrees(migration), before);
});

test('refuses a file named twice and a file that is not there, one line each', (t) => {
  const migration = makeMigration(t, [
    { remove: 'b.md' },
    { move: 'b.md', to: 'rules/b.md' },
    { remove: 'gone.md' },
  ]);
  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: step 2 names b.md, which step 1 names too; name each file in one step, `
      + 'nothing changed\n'
      + `${ PROGRAM }: step 3 names gone.md, which is no topic file in `
      + `${ migration.autoDirectory }; name a file that is there, nothing changed\n`,
    ],
  );
  assert.deepEqual(readTrees(migration), before);
});

test('refuses a target outside the three directories and one of another name form', (t) => {
  const migration = makeMigration(t, [
    { move: 'a.md', to: 'lessons/a.md' },
    { move: 'b.md', to: 'rules/B Rule.md' },
  ]);
  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);
  const noForm = 'which is not <work|rules|reference>/<name>.md with a name of lowercase letters, '
    + 'digits and hyphens; write it in that form, nothing changed\n';

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: step 1 moves a.md to lessons/a.md, ${ noForm }`
      + `${ PROGRAM }: step 2 moves b.md to rules/B Rule.md, ${ noForm }`,
    ],
  );
  assert.deepEqual(readTrees(migration), before);
});

test('refuses a target that exists and leaves it as it is', (t) => {
  const migration = makeMigration(t, STEPS);
  const memoryDirectory = join(migration.projectRoot, '.yapus', 'memory');

  runMigrate(t, migration, [migration.projectRoot]);
  writeFileSync(join(memoryDirectory, 'rules', 'a-rule.md'), 'kept\n');

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: step 1 moves a.md to rules/a-rule.md, which exists in ${ memoryDirectory }; `
      + 'choose another name or remove that file, nothing changed\n',
    ],
  );
  assert.deepEqual(readTrees(migration), before);
});

// The run cannot be given its time, so every second it can start in has a
// backup directory.
test('refuses a backup directory that exists and changes nothing', (t) => {
  const migration = makeMigration(t, STEPS);

  makeBackupDirectories(migration);

  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  assert.deepEqual([run.status, run.stdout], [2, '']);
  assert.match(
    run.stderr,
    /^yapus delegator migrate-memory: the backup directory .*\/memory-backup\/[0-9TZ-]+ exists; run the command again, nothing changed\n$/u,
  );
  assert.deepEqual(readTrees(migration), before);
});

test('refuses a moves file with a failure without apply too', (t) => {
  const migration = makeMigration(t, [{ remove: 'gone.md' }]);
  const run = runMigrate(t, migration, [migration.projectRoot]);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: step 1 names gone.md, which is no topic file in `
      + `${ migration.autoDirectory }; name a file that is there, nothing changed\n`,
    ],
  );
});

test('refuses an argument other than apply and creates nothing', (t) => {
  const migration = makeBareProject(t);
  const run = runMigrate(t, migration, [migration.projectRoot, 'now']);

  assert.deepEqual([run.status, run.stdout, run.stderr], [2, '', USAGE]);
  assert.deepEqual(readdirSync(migration.projectRoot), []);
});

test('refuses a third argument and changes nothing', (t) => {
  const migration = makeMigration(t, STEPS);
  const before = readTrees(migration);
  const run = runMigrate(t, migration, [migration.projectRoot, 'apply', 'apply']);

  assert.deepEqual([run.status, run.stdout, run.stderr], [2, '', USAGE]);
  assert.deepEqual(readTrees(migration), before);
});

test('refuses no argument and a relative project directory', (t) => {
  const migration = makeBareProject(t);
  const none = runMigrate(t, migration, []);
  const relative = spawnSync('bash', [RUN_SH, HOOK_NAME, '.'], {
    cwd: migration.projectRoot,
    encoding: 'utf8',
    env: makeEnv(t, migration),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [none.status, none.stdout, none.stderr, relative.status, relative.stdout, relative.stderr],
    [2, '', USAGE, 2, '', USAGE],
  );
  assert.deepEqual(readdirSync(migration.projectRoot), []);
});

test('refuses a project directory that is not there and creates nothing', (t) => {
  const migration = makeBareProject(t);
  const gone = join(migration.projectRoot, 'gone');
  const run = runMigrate(t, migration, [gone]);

  assert.deepEqual(
    [run.status, run.stdout, run.stderr],
    [
      2,
      '',
      `${ PROGRAM }: ${ gone } is not a directory; give the absolute path of the project, `
      + 'nothing changed\n',
    ],
  );
  assert.equal(existsSync(gone), false);
});

// The auto memory directory takes no removal, so the first step copies its
// file and cannot delete the source.
test('names the step that failed, makes none after it and exits 2', (t) => {
  const migration = makeMigration(t, STEPS);

  chmodSync(migration.autoDirectory, 0o555);

  const run = runMigrate(t, migration, [migration.projectRoot, 'apply']);

  chmodSync(migration.autoDirectory, 0o755);

  assert.deepEqual(
    [run.status, run.stdout],
    [
      2,
      `backup: ${ migration.autoDirectory } -> ${ findBackupDirectory(migration) }\n`
      + 'a.md -> rules/a-rule.md\nb.md removed\nc.md kept\n',
    ],
  );
  assert.match(
    run.stderr,
    /^yapus delegator migrate-memory: a\.md -> rules\/a-rule\.md failed: EACCES[^\n]*; no step after it is made; repair it and run the command again\n$/u,
  );
  assert.deepEqual(
    [readTree(migration.autoDirectory).map(([path]) => path), existsSync(getMovesPath(migration))],
    [['MEMORY.md', 'a.md', 'b.md', 'bytes.bin', 'c.md'], true],
  );
});

function runMigrate(t: TestContext, migration: Migration, args: readonly string[]) {
  return spawnSync('bash', [RUN_SH, HOOK_NAME, ...args], {
    cwd: makeTempDir(t),
    encoding: 'utf8',
    env: makeEnv(t, migration),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// The program reads CLAUDE_CONFIG_DIR alone; the others keep a run away from
// the person's own directories whatever it comes to read.
function makeEnv(t: TestContext, migration: Migration): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: makeTempDir(t),
    CLAUDE_CONFIG_DIR: migration.configDirectory,
    CLAUDE_PLUGIN_DATA: makeTempDir(t),
    CLAUDE_PROJECT_DIR: migration.projectRoot,
  };
}

// A project with no memory directory, and an auto memory with no file.
function makeBareProject(t: TestContext): Migration {
  const { configDirectory, memoryDirectory: autoDirectory } = makeAutoMemory(t, []);

  return { projectRoot: makeTempDir(t), configDirectory, autoDirectory };
}

// An auto memory with an index, three topic files and a file that is no
// text, and a project whose memory directory holds its ignore file and a
// moves file with the steps.
function makeMigration(t: TestContext, steps: readonly unknown[]): Migration {
  const { configDirectory, memoryDirectory: autoDirectory } = makeAutoMemory(t, [
    { path: 'MEMORY.md', text: INDEX_TEXT },
    { path: 'a.md', text: STORED_TEXT },
    { path: 'b.md', text: 'b\n' },
    { path: 'c.md', text: 'c\n' },
  ]);
  const projectRoot = makeMemoryProject(t, [
    { path: '.gitignore', text: '*\n' },
    { path: 'migration.json', text: JSON.stringify({ memoryDirectory: autoDirectory, steps }) },
  ]);

  writeFileSync(join(autoDirectory, 'bytes.bin'), Buffer.from([0xff, 0x00, 0x0a]));

  return { projectRoot, configDirectory, autoDirectory };
}

function getMovesPath({ projectRoot }: Migration): string {
  return join(projectRoot, '.yapus', 'memory', 'migration.json');
}

// The one backup directory beside the auto memory directory.
function findBackupDirectory({ autoDirectory }: Migration): string {
  const backupsDirectory = join(dirname(autoDirectory), 'memory-backup');
  const [stamp = ''] = readdirSync(backupsDirectory);

  return join(backupsDirectory, stamp);
}

// An empty backup directory for each second from now until a run that stays
// within its time limit has started.
function makeBackupDirectories({ autoDirectory }: Migration): void {
  const start = Date.now();

  for (let passed = 0; passed <= SUBPROCESS_TIMEOUT_MS + MILLISECONDS; passed += MILLISECONDS) {
    const stamp = `${ new Date(start + passed).toISOString().slice(0, 19).replaceAll(':', '-') }Z`;

    mkdirSync(join(dirname(autoDirectory), 'memory-backup', stamp), { recursive: true });
  }
}

// Every file of the project and of the configuration directory.
function readTrees({ projectRoot, configDirectory }: Migration): unknown[] {
  return [readTree(projectRoot), readTree(configDirectory)];
}

// What a run prints when the project has no moves file: the approved guide,
// then the order a fact is sorted by.
function getGuide(memoryDirectory: string): string {
  const movesPath = join(memoryDirectory, 'migration.json');
  const sorting = readSorting(memoryDirectory);

  assert.ok(sorting.kind === 'text');

  return `${ PROGRAM }: no moves file at ${ movesPath }. With no auto memory to sort, nothing `
    + 'more is needed. Otherwise read MEMORY.md and every file of the auto memory directory whole '
    + 'and sort each by the order below. Write the parts of a file that holds more than one fact '
    + 'as new files and give that file a remove step. Show the person one line per file, where '
    + 'it goes and why, and the candidates for the repository on their own. Then write '
    + `${ movesPath } as { "memoryDirectory": "<absolute path>", "steps": [ { "move": "<file>", `
    + '"to": "<directory>/<name>.md" }, { "remove": "<file>" } ] }; a file no step names stays.\n'
    + `${ sorting.text }\n`;
}
