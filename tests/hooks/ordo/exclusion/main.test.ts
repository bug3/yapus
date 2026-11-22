import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeLinkedWorktree } from '../../../helpers/exclusion/make-linked-worktree.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';

const RUN_SH = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 20000;
const SETTINGS = join('.claude', 'settings.local.json');
const PATTERN_SETTINGS =
  '{\n  "claudeMdExcludes": [\n    "**/.claude/rules/yapus/ordo/**"\n  ]\n}\n';
// Sorts before any temporary directory, as '0' comes before every letter.
const OTHER_ROOT = '/0/other';
const LAST_ROOT = '/~/last';
const USAGE = 'usage: ordo/exclusion <project dir> exclude|include, with HOME set\n';

interface ProjectFiles {
  readonly roots?: readonly string[];
  readonly settingsText?: string;
}

interface Project {
  readonly root: string;
  readonly home: string;
  readonly listPath: string;
  readonly settingsPath: string;
}

test('exclude writes the settings pattern and the list entry, settings first', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);
  const { status, stdout, stderr } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 0, stderr);
  assert.equal(
    stdout,
    `yapus ordo exclude: wrote\n  ${ settingsPath }\n  ${ listPath }\nTo undo: /ordo:include\n`,
  );
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
  assert.equal(readFileSync(listPath, 'utf8'), `[\n  "${ root }"\n]\n`);
});

test('exclude of an excluded project writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: PATTERN_SETTINGS,
  });
  const listText = writeList(listPath, [OTHER_ROOT, root]);
  const { status, stdout } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 0);
  assert.equal(stdout, `yapus ordo exclude: ${ root } is already excluded; nothing written\n`);
  assert.equal(readFileSync(listPath, 'utf8'), listText);
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
});

test('exclude with the list entry alone writes only the settings', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);
  const listText = writeList(listPath, [root]);
  const { status, stdout } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 0);
  assert.equal(stdout, `yapus ordo exclude: wrote\n  ${ settingsPath }\nTo undo: /ordo:include\n`);
  assert.equal(readFileSync(listPath, 'utf8'), listText);
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
});

test('exclude with the settings pattern alone writes only the list', (t) => {
  const { root, home, listPath } = makeProject(t, { settingsText: PATTERN_SETTINGS });
  const { status, stdout } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 0);
  assert.equal(stdout, `yapus ordo exclude: wrote\n  ${ listPath }\nTo undo: /ordo:include\n`);
  assert.equal(readFileSync(listPath, 'utf8'), `[\n  "${ root }"\n]\n`);
});

test('exclude adds the root to a list of other roots in sorted order', (t) => {
  const { root, home, listPath } = makeProject(t, { roots: [OTHER_ROOT, LAST_ROOT] });

  assert.equal(runExclusion(root, 'exclude', { home }).status, 0);
  assert.equal(
    readFileSync(listPath, 'utf8'),
    `[\n  "/0/other",\n  "${ root }",\n  "/~/last"\n]\n`,
  );
});

test('exclude keeps the other settings keys and entries and adds the pattern once', (t) => {
  const { root, home, settingsPath } = makeProject(t, {
    settingsText: '{"model": "opus", "claudeMdExcludes": ["**/other/**"], "env": {"A": "1"}}',
  });

  assert.equal(runExclusion(root, 'exclude', { home }).status, 0);
  assert.equal(
    readFileSync(settingsPath, 'utf8'),
    '{\n  "model": "opus",\n  "claudeMdExcludes": [\n    "**/other/**",\n'
      + '    "**/.claude/rules/yapus/ordo/**"\n  ],\n  "env": {\n    "A": "1"\n  }\n}\n',
  );
});

test('exclude adds the key to settings without one', (t) => {
  const { root, home, settingsPath } = makeProject(t, { settingsText: '{"model": "opus"}' });

  assert.equal(runExclusion(root, 'exclude', { home }).status, 0);
  assert.equal(
    readFileSync(settingsPath, 'utf8'),
    '{\n  "model": "opus",\n  "claudeMdExcludes": [\n'
      + '    "**/.claude/rules/yapus/ordo/**"\n  ]\n}\n',
  );
});

test('exclude refuses settings that are not JSON and writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, { settingsText: '{"model":' });
  const { status, stdout, stderr } = runExclusion(root, 'exclude', { home });

  assert.deepEqual([status, stdout], [2, '']);
  assert.equal(
    stderr,
    `yapus ordo exclude: ${ settingsPath } is not JSON; fix it by hand, nothing written\n`,
  );
  assert.equal(readFileSync(settingsPath, 'utf8'), '{"model":');
  assert.equal(existsSync(listPath), false);
});

test('exclude refuses settings that are a JSON array and writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, { settingsText: '[]' });
  const { status, stderr } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 2);
  assert.equal(
    stderr,
    `yapus ordo exclude: ${ settingsPath } is not a JSON object; fix it by hand, nothing written\n`,
  );
  assert.equal(readFileSync(settingsPath, 'utf8'), '[]');
  assert.equal(existsSync(listPath), false);
});

test('exclude refuses excludes that are not an array of strings and writes nothing', (t) => {
  const settingsText = '{"claudeMdExcludes": "**/other/**"}';
  const { root, home, listPath, settingsPath } = makeProject(t, { settingsText });
  const { status, stderr } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 2);
  assert.equal(
    stderr,
    `yapus ordo exclude: claudeMdExcludes in ${ settingsPath } is not an array of strings;`
      + ' fix it by hand, nothing written\n',
  );
  assert.equal(readFileSync(settingsPath, 'utf8'), settingsText);
  assert.equal(existsSync(listPath), false);
});

test('exclude refuses excludes that hold a number and writes nothing', (t) => {
  const settingsText = '{"claudeMdExcludes": ["**/other/**", 1]}';
  const { root, home, settingsPath } = makeProject(t, { settingsText });
  const { status, stderr } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 2);
  assert.match(stderr, /claudeMdExcludes in .* is not an array of strings;/);
  assert.equal(readFileSync(settingsPath, 'utf8'), settingsText);
});

test('exclude refuses an unsorted list and writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);
  const listText = writeList(listPath, ['/a/two', '/a/one']);
  const { status, stderr } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 2);
  assert.equal(
    stderr,
    `yapus ordo exclude: ${ listPath } is not a sorted array of distinct absolute paths;`
      + ' fix it by hand, nothing written\n',
  );
  assert.equal(readFileSync(listPath, 'utf8'), listText);
  assert.equal(existsSync(settingsPath), false);
});

test('include refuses a list that is not JSON and writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: PATTERN_SETTINGS,
  });

  writeFileSync(listPath, '["/a/one",');

  const { status, stderr } = runExclusion(root, 'include', { home });

  assert.equal(status, 2);
  assert.equal(
    stderr,
    `yapus ordo include: ${ listPath } is not JSON; fix it by hand, nothing written\n`,
  );
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
});

test('include refuses a list that cannot be read and writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: PATTERN_SETTINGS,
  });

  mkdirSync(listPath);

  const { status, stderr } = runExclusion(root, 'include', { home });

  assert.equal(status, 2);
  assert.equal(
    stderr,
    `yapus ordo include: ${ listPath } cannot be read; fix it by hand, nothing written\n`,
  );
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
});

test('refuses a project directory that does not exist', (t) => {
  const home = makeTempDir(t);
  const missing = join(makeTempDir(t), 'missing');
  const { status, stderr } = runExclusion(missing, 'exclude', { home });

  assert.equal(status, 2);
  assert.equal(
    stderr,
    `yapus ordo exclude: ${ missing } is not a directory;`
      + ' open the session in the project, nothing written\n',
  );
  assert.equal(existsSync(join(home, '.claude')), false);
});

test('exclude from a linked worktree writes the main root and its settings', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);

  runGit(['add', '.gitignore'], root);

  const worktree = makeLinkedWorktree(t, root);

  assert.equal(runExclusion(worktree, 'exclude', { home }).status, 0);
  assert.equal(readFileSync(listPath, 'utf8'), `[\n  "${ root }"\n]\n`);
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
  assert.equal(existsSync(join(worktree, SETTINGS)), false);
});

test('exclude from a subdirectory writes the main root and its settings', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);
  const subdirectory = join(root, 'sub');

  mkdirSync(subdirectory);

  assert.equal(runExclusion(subdirectory, 'exclude', { home }).status, 0);
  assert.equal(readFileSync(listPath, 'utf8'), `[\n  "${ root }"\n]\n`);
  assert.equal(readFileSync(settingsPath, 'utf8'), PATTERN_SETTINGS);
  assert.equal(existsSync(join(subdirectory, SETTINGS)), false);
});

test('include takes out the root and the pattern and keeps the rest', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: '{"model": "opus", "claudeMdExcludes":'
      + ' ["**/other/**", "**/.claude/rules/yapus/ordo/**"]}',
  });

  writeList(listPath, [OTHER_ROOT, root]);

  const { status, stdout, stderr } = runExclusion(root, 'include', { home });

  assert.equal(status, 0, stderr);
  assert.equal(
    stdout,
    `yapus ordo include: wrote\n  ${ settingsPath }\n  ${ listPath }\nTo undo: /ordo:exclude\n`,
  );
  assert.equal(
    readFileSync(settingsPath, 'utf8'),
    '{\n  "model": "opus",\n  "claudeMdExcludes": [\n    "**/other/**"\n  ]\n}\n',
  );
  assert.equal(readFileSync(listPath, 'utf8'), '[\n  "/0/other"\n]\n');
});

test('include with the settings pattern absent writes only the list', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: '{"model": "opus"}',
  });

  writeList(listPath, [root]);

  const { status, stdout } = runExclusion(root, 'include', { home });

  assert.equal(status, 0);
  assert.equal(stdout, `yapus ordo include: wrote\n  ${ listPath }\nTo undo: /ordo:exclude\n`);
  assert.equal(readFileSync(settingsPath, 'utf8'), '{"model": "opus"}');
  assert.equal(readFileSync(listPath, 'utf8'), '[]\n');
});

test('include leaves {} where the pattern stood alone', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: PATTERN_SETTINGS,
  });

  writeList(listPath, [root]);

  assert.equal(runExclusion(root, 'include', { home }).status, 0);
  assert.equal(readFileSync(settingsPath, 'utf8'), '{}\n');
  assert.equal(readFileSync(listPath, 'utf8'), '[]\n');
});

test('include with no list takes out the settings pattern alone', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t, {
    settingsText: PATTERN_SETTINGS,
  });
  const { status, stdout } = runExclusion(root, 'include', { home });

  assert.equal(status, 0);
  assert.equal(stdout, `yapus ordo include: wrote\n  ${ settingsPath }\nTo undo: /ordo:exclude\n`);
  assert.equal(readFileSync(settingsPath, 'utf8'), '{}\n');
  assert.equal(existsSync(listPath), false);
});

test('include of a project that is not excluded writes nothing', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);
  const { status, stdout } = runExclusion(root, 'include', { home });

  assert.equal(status, 0);
  assert.equal(stdout, `yapus ordo include: ${ root } is not excluded; nothing written\n`);
  assert.equal(existsSync(listPath), false);
  assert.equal(existsSync(settingsPath), false);
});

test('exclude warns when git does not ignore the settings file', (t) => {
  const repo = makeTempRepo(t);
  const root = realpathSync(repo);
  const home = makeTempDir(t);
  const { status, stdout } = runExclusion(repo, 'exclude', { home });

  assert.equal(status, 0);
  assert.equal(
    stdout.split('\n').slice(-3).join('\n'),
    `To undo: /ordo:include\nyapus ordo exclude: git does not ignore ${ join(root, SETTINGS) };`
      + ' add it to .gitignore or .git/info/exclude before a commit takes it in\n',
  );
});

test('exclude outside git writes the directory itself without a warning', (t) => {
  const directory = realpathSync(makeTempDir(t));
  const home = makeTempDir(t);
  const listPath = join(home, '.claude', 'yapus', 'ordo', 'excluded.json');
  const { status, stdout } = runExclusion(directory, 'exclude', { home });

  assert.equal(status, 0);
  assert.equal(
    stdout,
    `yapus ordo exclude: wrote\n  ${ join(directory, SETTINGS) }\n  ${ listPath }\n`
      + 'To undo: /ordo:include\n',
  );
  assert.equal(readFileSync(listPath, 'utf8'), `[\n  "${ directory }"\n]\n`);
});

test('refuses a mode other than exclude or include', (t) => {
  const { root, home, listPath, settingsPath } = makeProject(t);
  const { status, stdout, stderr } = runExclusion(root, 'off', { home });

  assert.deepEqual([status, stdout, stderr], [2, '', USAGE]);
  assert.deepEqual([existsSync(listPath), existsSync(settingsPath)], [false, false]);
});

// A run in a temporary directory, since a list path built from an empty HOME
// would be relative to the working directory.
test('refuses a run without HOME', (t) => {
  const { root, settingsPath } = makeProject(t);
  const cwd = makeTempDir(t);
  const { status, stderr } = runExclusion(root, 'exclude', { home: '', cwd });

  assert.deepEqual([status, stderr], [2, USAGE]);
  assert.deepEqual([existsSync(settingsPath), existsSync(join(cwd, '.claude'))], [false, false]);
});

test('reports a crash as one line', (t) => {
  const { root, home, settingsPath } = makeProject(t);

  mkdirSync(settingsPath, { recursive: true });

  const { status, stderr } = runExclusion(root, 'exclude', { home });

  assert.equal(status, 2);
  assert.match(stderr, /^yapus ordo exclude: crashed: EISDIR[^\n]*\n$/);
});

// A temporary repository whose .gitignore holds the settings file, with its
// real root, and a temporary home; roots and settingsText fill the list and
// the settings first when given.
function makeProject(
  t: TestContext,
  { roots, settingsText }: ProjectFiles = {},
): Project {
  const root = realpathSync(makeTempRepo(t));
  const home = makeTempDir(t);
  const listPath = join(home, '.claude', 'yapus', 'ordo', 'excluded.json');
  const settingsPath = join(root, SETTINGS);

  writeFileSync(join(root, '.gitignore'), '.claude/settings.local.json\n');
  mkdirSync(join(home, '.claude', 'yapus', 'ordo'), { recursive: true });

  if (roots !== undefined) {
    writeList(listPath, roots);
  }

  if (settingsText !== undefined) {
    mkdirSync(join(root, '.claude'));
    writeFileSync(settingsPath, settingsText);
  }

  return { root, home, listPath, settingsPath };
}

function writeList(listPath: string, roots: readonly string[]): string {
  const listText = `${ JSON.stringify(roots) }\n`;

  writeFileSync(listPath, listText);

  return listText;
}

function runExclusion(
  directory: string,
  mode: string,
  { home, cwd }: { readonly home: string; readonly cwd?: string },
): SpawnSyncReturns<string> {
  return spawnSync('bash', [RUN_SH, 'ordo/exclusion', directory, mode], {
    cwd,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), HOME: home },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
