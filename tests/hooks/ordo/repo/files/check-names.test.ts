import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeTempFiles } from '../../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');
const CHECK_NAMES = join(ROOT, 'hooks', 'ordo', 'repo', 'files', 'check-names.sh');
const RULE = 'is not lowercase words joined by hyphens, parts by underscores; rename it';
const SUBPROCESS_TIMEOUT_MS = 10000;
const BASH = getCommandPath('bash');

function getCommandPath(command: string): string {
  return execFileSync('/bin/sh', ['-c', `command -v ${ command }`], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  }).trim();
}

// A temporary git work tree holding an empty file at each path, untracked.
function makeTree(t: TestContext, paths: readonly string[]): string {
  return makeTempFiles(t, paths.map((path) => ({ path, text: '' })));
}

function checkNames(cwd: string, env: NodeJS.ProcessEnv = getGitEnv(process.env)) {
  const checkRun = spawnSync(BASH, [CHECK_NAMES], {
    cwd,
    encoding: 'utf8',
    env,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return [checkRun.status, checkRun.stdout, checkRun.stderr];
}

function refusal(path: string, segment: string): string {
  return `yapus names: ${ path }: ${ segment } ${ RULE }\n`;
}

test('exits 0 silently on chosen, uppercase, Go, Python and tool-owned names', (t) => {
  const root = makeTree(t, [
    'research_ee0fa4b4.md',
    'get-dash-lines.test.ts',
    'eslint.config.ts',
    '.gitignore',
    '.claude-plugin/plugin.json',
    'hooks/git/commit-msg',
    'go.mod',
    '20-11_a-b.md',
    'README.md',
    '.github/ISSUE_TEMPLATE/bug.md',
    'LICENSE',
    'pkg/__init__.py',
    'store_linux.go',
    'Makefile',
    'Dockerfile',
    'src/__tests__/a.test.ts',
    'content/_index.md',
    'pages/[id].tsx',
    'pages/_app.tsx',
    'styles/_main-layout.scss',
    'pkg/testdata/Odd Name.txt',
    '.DS_Store',
    'Cargo.toml',
  ]);

  assert.deepEqual(checkNames(root), [0, '', '']);
});

test('skips the names of Go and Python files but checks their folders', (t) => {
  const root = makeTree(t, ['fooBar_test.go', 'Mod_Name.py', 'Stubs.pyi', 'Foo/x.go']);

  assert.deepEqual(checkNames(root), [2, '', refusal('Foo/x.go', 'Foo')]);
});

test('checks the name of a PHP file like a chosen name', (t) => {
  const root = makeTree(t, ['src/AgeCalculationService.php', 'src/age-calculation.php']);

  assert.deepEqual(
    checkNames(root),
    [2, '', refusal('src/AgeCalculationService.php', 'AgeCalculationService.php')],
  );
});

test('skips every path below a vendor folder but checks the folders above it', (t) => {
  const root = makeTree(t, [
    'vendor/github.com/BurntSushi/toml/decode.go',
    'vendor/github.com/BurntSushi/toml/Odd Name.txt',
    'Lib/vendor/x.md',
  ]);

  assert.deepEqual(checkNames(root), [2, '', refusal('Lib/vendor/x.md', 'Lib')]);
});

test('refuses a capital inside a word', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['getDashLines.ts'])),
    [2, '', refusal('getDashLines.ts', 'getDashLines.ts')],
  );
});

test('refuses two hyphens in a row', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['get--dash.ts'])),
    [2, '', refusal('get--dash.ts', 'get--dash.ts')],
  );
});

test('refuses a leading hyphen', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['-lead.md'])),
    [2, '', refusal('-lead.md', '-lead.md')],
  );
});

test('refuses a trailing hyphen', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['trail-.md'])),
    [2, '', refusal('trail-.md', 'trail-.md')],
  );
});

test('refuses two underscores in a row', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['a__b.md'])),
    [2, '', refusal('a__b.md', 'a__b.md')],
  );
});

test('refuses a leading underscore on a name no tool owns', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['_draft.md'])),
    [2, '', refusal('_draft.md', '_draft.md')],
  );
});

test('refuses a Sass partial whose name after the underscore is not chosen', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['_Main.scss', '__x.scss', '_y.css'])),
    [2, '', [
      refusal('_Main.scss', '_Main.scss'),
      refusal('__x.scss', '__x.scss'),
      refusal('_y.css', '_y.css'),
    ].join('')],
  );
});

test('accepts a UTC time as one word', (t) => {
  const root = makeTree(t, [
    '2026-04-11T22-06-47Z.md',
    'v001-2026-04-11T22-06-47Z.md',
    '25T09-20-46Z_02028185-086e.jsonl',
    'runs/2026-11-25T09Z/log.md',
  ]);

  assert.deepEqual(checkNames(root), [0, '', '']);
});

test('refuses a T or Z outside a UTC time', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['09-20-46Z.md', '25T09-20-46.md', 'aT09Z.md', '25T09-Z.md'])),
    [2, '', [
      refusal('09-20-46Z.md', '09-20-46Z.md'),
      refusal('25T09-20-46.md', '25T09-20-46.md'),
      refusal('25T09-Z.md', '25T09-Z.md'),
      refusal('aT09Z.md', 'aT09Z.md'),
    ].join('')],
  );
});

test('refuses a capitalized word outside the uppercase class', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['Notes.md'])),
    [2, '', refusal('Notes.md', 'Notes.md')],
  );
});

test('refuses a capitalized folder and names the folder', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['Foo/x.md'])),
    [2, '', refusal('Foo/x.md', 'Foo')],
  );
});

test('refuses a space in a folder name', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['my dir/x.md'])),
    [2, '', refusal('my dir/x.md', 'my dir')],
  );
});

test('refuses an empty part between dots', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['x..md'])),
    [2, '', refusal('x..md', 'x..md')],
  );
});

test('refuses an uppercase extension', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['foo.MD'])),
    [2, '', refusal('foo.MD', 'foo.MD')],
  );
});

test('refuses a tool-owned name with a suffix', (t) => {
  assert.deepEqual(
    checkNames(makeTree(t, ['Makefile2'])),
    [2, '', refusal('Makefile2', 'Makefile2')],
  );
});

test('checks the whole work tree when run from a subfolder', (t) => {
  const root = makeTree(t, ['sub/a.md', 'Top.md']);

  assert.deepEqual(
    checkNames(join(root, 'sub')),
    [2, '', refusal('Top.md', 'Top.md')],
  );
});

test('skips a path git ignores', (t) => {
  const root = makeTempFiles(t, [
    { path: '.gitignore', text: 'Build/\n' },
    { path: 'Build/x.md', text: '' },
  ]);

  assert.deepEqual(checkNames(root), [0, '', '']);
});

test('skips a tracked path that is gone from disk', (t) => {
  const root = makeTree(t, ['Gone.md']);

  runGit(['add', 'Gone.md'], root);
  rmSync(join(root, 'Gone.md'));

  assert.deepEqual(checkNames(root), [0, '', '']);
});

test('writes one line for a failing path that a merge leaves in conflict', (t) => {
  const root = makeTempFiles(t, [{ path: 'Notes.md', text: 'base\n' }]);
  const commitNotes = (text: string) => {
    writeFileSync(join(root, 'Notes.md'), text);
    runGit(['commit', '--quiet', '--all', '--message', text], root);
  };

  runGit(['add', 'Notes.md'], root);
  runGit(['commit', '--quiet', '--message', 'base'], root);
  runGit(['checkout', '--quiet', '-b', 'other'], root);
  commitNotes('other\n');
  runGit(['checkout', '--quiet', '-'], root);
  commitNotes('this\n');
  assert.throws(() => runGit(['merge', '--quiet', 'other'], root));

  assert.deepEqual(checkNames(root), [2, '', refusal('Notes.md', 'Notes.md')]);
});

test('exits 2 with one line naming the folder and git\'s error outside a git work tree', (t) => {
  const outside = realpathSync(makeTempDir(t));
  const env = { ...getGitEnv(process.env), GIT_CEILING_DIRECTORIES: dirname(outside) };

  assert.deepEqual(checkNames(outside, env), [
    2,
    '',
    `yapus names: ${ outside }: fatal: not a git repository (or any of the parent directories): .git\n`,
  ]);
});

test('exits 2 with git\'s own error when git refuses the repository', (t) => {
  const root = realpathSync(makeTree(t, ['a.md']));
  const gitDir = join(root, 'missing');
  const env = { ...getGitEnv(process.env), GIT_DIR: gitDir };

  assert.deepEqual(checkNames(root, env), [
    2,
    '',
    `yapus names: ${ root }: fatal: not a git repository: '${ gitDir }'\n`,
  ]);
});

// A git owned by another user fails rev-parse with several lines, of which
// the first names the cause; a stand-in on PATH gives that output here.
test('keeps only the first line of a git error of several lines', (t) => {
  const root = realpathSync(makeTree(t, ['a.md']));
  const bin = makeTempDir(t);
  const env = { ...getGitEnv(process.env), PATH: bin };

  writeFileSync(join(bin, 'git'), [
    '#!/bin/sh',
    'printf "%s\\n" "fatal: detected dubious ownership in repository at $PWD" "To add an exception, call:" >&2',
    'exit 128',
    '',
  ].join('\n'), { mode: 0o755 });

  assert.deepEqual(checkNames(root, env), [
    2,
    '',
    `yapus names: ${ root }: fatal: detected dubious ownership in repository at ${ root }\n`,
  ]);
});

test('exits 2 with one line when git is not found', (t) => {
  const root = makeTree(t, ['a.md']);
  const env = { ...getGitEnv(process.env), PATH: makeTempDir(t) };

  assert.deepEqual(checkNames(root, env), [2, '', 'yapus names: git not found; install git\n']);
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [CHECK_NAMES], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});
