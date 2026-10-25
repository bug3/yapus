import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { commitFiles } from './plan/commit-files.ts';
import { copyPlugin, PLUGIN, runProject } from './run-project.ts';

const OWNED = '.landmark/eslint.config.ts';
const WRAPPER = 'eslint.config.ts';
const OWNED_TSCONFIG = '.landmark/tsconfig.json';
const WRAPPER_TSCONFIG = 'tsconfig.json';
const SCOPES = '.landmark/scopes.json';
const BASE_DIR = join(
  import.meta.dirname,
  ...['..', '..', '..', '..', 'hooks', 'landmark', 'project', 'files'],
);

function readVersion(): unknown {
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  return isRecord(manifest) ? manifest.version : undefined;
}

function readBase(name: string): string {
  return readFileSync(join(BASE_DIR, name), 'utf8');
}

function readRepoFile(repo: string, path: string): string {
  return readFileSync(join(repo, path), 'utf8');
}

function commitAll(repo: string): void {
  runGit(['add', '--all'], repo);
  runGit(['commit', '--quiet', '--message', 'test'], repo);
}

test('installs into a fresh repository and prints the approved lines', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['README.md', 'x']]);

  const run = runProject(copyPlugin(t), repo);

  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, [
    'yapus landmark project install: wrote',
    '  .landmark/eslint.config.ts',
    '  .landmark/tsconfig.json',
    '  .github/workflows/landmark.yml',
    '  eslint.config.ts',
    '  tsconfig.json',
    '  .landmark/scopes.json',
    '  .gitignore',
    '  package.json',
    '  .landmark/version',
    'package.json: set scripts.check, devDependencies.@eslint/js, '
    + 'devDependencies.@stylistic/eslint-plugin, devDependencies.@types/node, '
    + 'devDependencies.eslint, devDependencies.typescript, devDependencies.typescript-eslint, '
    + 'engines.node, type, scripts.test',
    'Next:',
    '  npm install',
    '  npm test',
    '  commit the changes',
    'To undo:',
    '  remove .landmark/eslint.config.ts .landmark/tsconfig.json .github/workflows/landmark.yml '
    + 'eslint.config.ts tsconfig.json .landmark/scopes.json .gitignore package.json '
    + '.landmark/version',
    '',
  ].join('\n'));
  assert.equal(readRepoFile(repo, OWNED), readBase('eslint.config.ts'));
  assert.equal(readRepoFile(repo, OWNED_TSCONFIG), readBase('tsconfig.json'));
  assert.match(readRepoFile(repo, WRAPPER), /from '\.\/\.landmark\/eslint\.config\.ts'/);
  assert.match(readRepoFile(repo, WRAPPER_TSCONFIG), /"extends": "\.\/\.landmark\/tsconfig\.json"/);
  assert.equal(readRepoFile(repo, '.landmark/version'), readVersion());
});

test('upgrade rewrites owned files and the stamp and keeps wrapper files', (t) => {
  const repo = makeTempRepo(t);
  const root = copyPlugin(t);
  const customWrapper = 'changed wrapper\n';
  const customTsconfig = '{"extends": "./mine.json"}\n';
  const customScopes = '["mine"]\n';

  commitFiles(repo, [['README.md', 'x']]);
  assert.equal(runProject(root, repo).status, 0);
  commitAll(repo);

  const installedPackage = readRepoFile(repo, 'package.json');
  const customPackage = installedPackage.replace(/"test": "(?:[^"\\]|\\.)*"/, '"test": "my own test"');

  assert.notEqual(customPackage, installedPackage);
  writeFileSync(join(repo, 'package.json'), customPackage);
  writeFileSync(join(repo, OWNED), 'changed owned\n');
  writeFileSync(join(repo, OWNED_TSCONFIG), '{}\n');
  writeFileSync(join(repo, '.landmark', 'version'), '0.0.1');
  writeFileSync(join(repo, WRAPPER), customWrapper);
  writeFileSync(join(repo, WRAPPER_TSCONFIG), customTsconfig);
  writeFileSync(join(repo, SCOPES), customScopes);
  commitAll(repo);

  const run = runProject(root, repo);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^yapus landmark project upgrade: wrote\n/);
  assert.equal(readRepoFile(repo, OWNED), readBase('eslint.config.ts'));
  assert.equal(readRepoFile(repo, OWNED_TSCONFIG), readBase('tsconfig.json'));
  assert.equal(readRepoFile(repo, '.landmark/version'), readVersion());
  assert.doesNotMatch(run.stdout, /remove /);
  assert.doesNotMatch(run.stdout, /package\.json/);
  assert.equal(readRepoFile(repo, WRAPPER), customWrapper);
  assert.equal(readRepoFile(repo, WRAPPER_TSCONFIG), customTsconfig);
  assert.equal(readRepoFile(repo, SCOPES), customScopes);
  assert.equal(readRepoFile(repo, 'package.json'), customPackage);
});

test('install removes a legacy ESLint config and names it', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['.eslintrc.json', '{}\n'], ['eslint.config.js', 'export default [];\n']]);

  const run = runProject(copyPlugin(t), repo);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /\nremoved\n {2}eslint\.config\.js\n {2}\.eslintrc\.json\npackage\.json: /);
  assert.match(
    run.stdout,
    /\nTo undo:\n {2}git restore --staged --worktree -- eslint\.config\.js \.eslintrc\.json\n {2}remove /,
  );
  assert.ok(!existsSync(join(repo, '.eslintrc.json')));
  assert.ok(!existsSync(join(repo, 'eslint.config.js')));
});

test('refuses on an uncommitted package.json and writes nothing', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['package.json', '{}\n']]);
  writeFileSync(join(repo, 'package.json'), '{"name": "x"}\n');

  const before = runGit(['status', '--porcelain'], repo);
  const run = runProject(copyPlugin(t), repo);

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, [
    'yapus landmark project: refused, nothing written',
    'package.json has an uncommitted or untracked change; commit or stash it first',
    '',
  ].join('\n'));
  assert.equal(runGit(['status', '--porcelain'], repo), before);
});

test('crashes on an unparsable package.json and writes nothing', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['package.json', '{not json']]);

  const run = runProject(copyPlugin(t), repo);

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^yapus landmark project: crashed: [^\n]*package\.json[^\n]*\n$/);
  assert.equal(runGit(['status', '--porcelain'], repo), '');
  assert.ok(!existsSync(join(repo, '.landmark')));
});

test('prints the usage and exits 2 without two arguments', (t) => {
  const root = copyPlugin(t);
  const run = spawnSync('bash', [join(root, 'runtime', 'run.sh'), 'landmark/project', root], {
    encoding: 'utf8',
    env: getGitEnv(process.env),
    timeout: 20000,
  });

  assert.equal(run.status, 2);
  assert.equal(run.stderr, 'usage: landmark/project <plugin root> <project dir>\n');
});
