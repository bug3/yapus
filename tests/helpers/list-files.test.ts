import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { listAllFiles, listFiles, listModules } from './list-files.ts';
import { makeTempDir } from './make-temp-dir.ts';
import { makeTempRepo } from './make-temp-repo.ts';
import { getGitEnv, runGit } from './run-git.ts';

const LIST_FILES_URL = pathToFileURL(join(import.meta.dirname, 'list-files.ts')).href;
const SUBPROCESS_TIMEOUT_MS = 10000;
const LIST_ALL = `
  const { listAllFiles } = await import(process.argv[1]);
  process.stdout.write(listAllFiles(process.argv[2]).join('\\n'));
`;

// listAllFiles reads the caller's git config, so the cases on a temporary tree
// pin it to none: a developer's global excludes then hide none of their files.
Object.assign(process.env, getGitEnv({}));

test('lists untracked files by extension, relative to the root', (t) => {
  const root = makeTree(t);

  assert.deepEqual(listFiles(root, '.ts').sort(), [
    'eslint.config.ts',
    'hooks/dashes/get-name.ts',
    'hooks/dashes/main.ts',
    'tests/hooks/dashes/get-name.test.ts',
  ]);
});

test('lists tracked files beside untracked ones', (t) => {
  const root = makeTree(t);

  runGit(['add', 'package.json'], root);

  assert.deepEqual(listFiles(root, '.json').sort(), [
    'node_modules/pkg/package.json',
    'package.json',
  ]);
});

test('skips the files git ignores', (t) => {
  const root = makeTree(t);

  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');

  assert.deepEqual(listFiles(root, '.json'), ['package.json']);
});

test('skips a tracked file deleted from disk', (t) => {
  const root = makeTree(t);

  runGit(['add', 'package.json'], root);
  rmSync(join(root, 'package.json'));

  assert.deepEqual(listFiles(root, '.json'), ['node_modules/pkg/package.json']);
});

test('skips a link to a directory', (t) => {
  const root = makeTree(t);

  symlinkSync('hooks', join(root, 'runtime'));

  assert.equal(listAllFiles(root).includes('runtime'), false);
});

test('skips a file the caller\'s global excludes hide, whatever git variables it has', (t) => {
  const root = makeTempRepo(t);
  const outerRepo = makeTempRepo(t);
  const home = makeTempDir(t);
  const excludes = join(home, 'excludes');
  const globalConfig = join(home, '.gitconfig');

  writeFileSync(join(root, 'hidden.md'), '');
  writeFileSync(join(root, 'kept.md'), '');
  writeFileSync(join(outerRepo, '.git', 'info', 'exclude'), 'kept.md\n');
  writeFileSync(excludes, 'hidden.md\n');
  writeFileSync(globalConfig, `[core]\n\texcludesFile = ${ excludes }\n`);

  const listing = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', LIST_ALL, LIST_FILES_URL, root],
    {
      encoding: 'utf8',
      timeout: SUBPROCESS_TIMEOUT_MS,
      env: {
        ...process.env,
        HOME: home,
        GIT_DIR: join(outerRepo, '.git'),
        GIT_CONFIG_GLOBAL: globalConfig,
      },
    },
  );

  assert.equal(listing, 'kept.md');
});

test('lists modules without tests, entries and tool-named files', (t) => {
  const root = makeTree(t);

  assert.deepEqual(listModules(root), ['hooks/dashes/get-name.ts']);
});

function makeTree(t: TestContext): string {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'hooks', 'dashes'), { recursive: true });
  mkdirSync(join(root, 'tests', 'hooks', 'dashes'), { recursive: true });
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'eslint.config.ts'), '');
  writeFileSync(join(root, 'hooks', 'dashes', 'main.ts'), '');
  writeFileSync(join(root, 'hooks', 'dashes', 'get-name.ts'), '');
  writeFileSync(join(root, 'tests', 'hooks', 'dashes', 'get-name.test.ts'), '');
  writeFileSync(join(root, 'node_modules', 'pkg', 'package.json'), '');
  writeFileSync(join(root, 'package.json'), '');

  return root;
}
