import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import {
  getGolangciLintVersion,
} from '../../../../hooks/ordo/repo/files/go/get-golangci-lint-version.ts';
import { readTemplates } from '../../../../hooks/ordo/repo/files/read-templates.ts';
import { commitFiles } from './plan/commit-files.ts';
import { copyPlugin, PLUGIN, runProject } from './run-project.ts';

const USAGE = 'usage: ordo/repo <plugin root> <project dir> [typescript|go]';
const OWNED = '.claude/yapus/ordo/eslint.config.ts';
const WRAPPER = 'eslint.config.ts';
const OWNED_TSCONFIG = '.claude/yapus/ordo/tsconfig.json';
const WRAPPER_TSCONFIG = 'tsconfig.json';
const SCOPES = '.claude/yapus/ordo/scopes.json';
const LANGUAGE_RECORD = '.claude/yapus/ordo/language';
const BASE_DIR = join(
  import.meta.dirname,
  ...['..', '..', '..', '..', 'hooks', 'ordo', 'repo', 'files', 'typescript'],
);

function readVersion(): unknown {
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  assert.ok(isRecord(manifest));

  return manifest.version;
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
    'yapus ordo repo install: wrote',
    '  .claude/yapus/ordo/eslint.config.ts',
    '  .claude/yapus/ordo/tsconfig.json',
    '  .github/workflows/yapus.yml',
    '  eslint.config.ts',
    '  tsconfig.json',
    '  .claude/yapus/ordo/scopes.json',
    '  .gitignore',
    '  .claude/yapus/ordo/language',
    '  package.json',
    '  .claude/yapus/ordo/version',
    'package.json: set scripts.check, devDependencies.@eslint/js, '
    + 'devDependencies.@stylistic/eslint-plugin, devDependencies.@types/node, '
    + 'devDependencies.eslint, devDependencies.typescript, devDependencies.typescript-eslint, '
    + 'engines.node, type, scripts.test',
    'Next:',
    '  npm install',
    '  npm test',
    '  commit the changes',
    'To undo:',
    '  remove .claude/yapus/ordo/eslint.config.ts .claude/yapus/ordo/tsconfig.json .github/workflows/yapus.yml '
    + 'eslint.config.ts tsconfig.json .claude/yapus/ordo/scopes.json .gitignore '
    + '.claude/yapus/ordo/language package.json .claude/yapus/ordo/version',
    '',
  ].join('\n'));
  assert.equal(readRepoFile(repo, OWNED), readBase('eslint.config.ts'));
  assert.equal(readRepoFile(repo, OWNED_TSCONFIG), readBase('tsconfig.json'));
  assert.match(readRepoFile(repo, WRAPPER), /from '\.\/\.claude\/yapus\/ordo\/eslint\.config\.ts'/);
  assert.match(readRepoFile(repo, WRAPPER_TSCONFIG), /"extends": "\.\/\.claude\/yapus\/ordo\/tsconfig\.json"/);
  assert.equal(readRepoFile(repo, '.claude/yapus/ordo/version'), readVersion());
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
  writeFileSync(join(repo, '.claude', 'yapus', 'ordo', 'version'), '0.0.1');
  writeFileSync(join(repo, WRAPPER), customWrapper);
  writeFileSync(join(repo, WRAPPER_TSCONFIG), customTsconfig);
  writeFileSync(join(repo, SCOPES), customScopes);
  commitAll(repo);

  const run = runProject(root, repo);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^yapus ordo repo upgrade: wrote\n/);
  assert.equal(readRepoFile(repo, OWNED), readBase('eslint.config.ts'));
  assert.equal(readRepoFile(repo, OWNED_TSCONFIG), readBase('tsconfig.json'));
  assert.equal(readRepoFile(repo, '.claude/yapus/ordo/version'), readVersion());
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
    'yapus ordo repo: refused, nothing written',
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
  assert.match(run.stderr, /^yapus ordo repo: crashed: [^\n]*package\.json[^\n]*\n$/);
  assert.equal(runGit(['status', '--porcelain'], repo), '');
  assert.ok(!existsSync(join(repo, '.claude', 'yapus', 'ordo')));
});

test('prints the usage and exits 2 without two arguments', (t) => {
  const root = copyPlugin(t);
  const run = spawnSync('bash', [join(root, 'runtime', 'run.sh'), 'ordo/repo', root], {
    encoding: 'utf8',
    env: getGitEnv(process.env),
    timeout: 20000,
  });

  assert.equal(run.status, 2);
  assert.equal(run.stderr, `${ USAGE }\n`);
});

const GO_FILES = [
  ['go.mod', 'module x\n'],
  ['.golangci.yml', 'old\n'],
  ['.golangci.yaml', 'old\n'],
] as const;
const GO_WORKFLOW = '.github/workflows/yapus.yml';

function readGoTemplate(target: string): string {
  const template = readTemplates('go').find((entry) => entry.target === target);

  assert.ok(template !== undefined);

  return template.text;
}

test('go installs into a Go repository and prints the approved lines', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, GO_FILES);

  const run = runProject(copyPlugin(t), repo, 'go');

  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, [
    'yapus ordo repo install: wrote',
    '  .golangci.yml',
    '  .github/workflows/yapus.yml',
    '  .claude/yapus/ordo/scopes.json',
    '  .claude/yapus/ordo/language',
    '  .claude/yapus/ordo/version',
    'removed',
    '  .golangci.yaml',
    'Next:',
    `  curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b "$(go env GOPATH)/bin" ${
      getGolangciLintVersion() }`,
    '  golangci-lint run ./...',
    '  go test ./...',
    '  commit the changes',
    'To undo:',
    '  git restore --staged --worktree -- .golangci.yml .golangci.yaml',
    '  remove .github/workflows/yapus.yml .claude/yapus/ordo/scopes.json '
    + '.claude/yapus/ordo/language .claude/yapus/ordo/version',
    '',
  ].join('\n'));
  assert.equal(readRepoFile(repo, '.golangci.yml'), readGoTemplate('.golangci.yml'));
  assert.equal(readRepoFile(repo, GO_WORKFLOW), readGoTemplate(GO_WORKFLOW));
  assert.equal(readRepoFile(repo, LANGUAGE_RECORD), 'go\n');
  assert.ok(!existsSync(join(repo, 'package.json')));
  assert.ok(!existsSync(join(repo, '.gitignore')));
  assert.ok(!existsSync(join(repo, '.golangci.yaml')));
});

test('upgrade follows the recorded Go language and keeps the record and scopes', (t) => {
  const repo = makeTempRepo(t);
  const root = copyPlugin(t);

  commitFiles(repo, GO_FILES);
  assert.equal(runProject(root, repo, 'go').status, 0);
  commitAll(repo);

  const scopes = readRepoFile(repo, SCOPES);

  writeFileSync(join(repo, '.golangci.yml'), 'changed\n');
  writeFileSync(join(repo, GO_WORKFLOW), 'changed\n');
  writeFileSync(join(repo, '.claude', 'yapus', 'ordo', 'version'), '0.0.1');
  commitAll(repo);

  const run = runProject(root, repo);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^yapus ordo repo upgrade: wrote\n/);
  assert.equal(readRepoFile(repo, '.golangci.yml'), readGoTemplate('.golangci.yml'));
  assert.equal(readRepoFile(repo, GO_WORKFLOW), readGoTemplate(GO_WORKFLOW));
  assert.equal(readRepoFile(repo, '.claude/yapus/ordo/version'), readVersion());
  assert.equal(readRepoFile(repo, SCOPES), scopes);
  assert.equal(readRepoFile(repo, LANGUAGE_RECORD), 'go\n');
  assert.ok(!existsSync(join(repo, 'package.json')));
  assert.ok(!existsSync(join(repo, OWNED)));
});

test('go refuses without a root go.mod and writes nothing', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['README.md', 'x']]);

  const before = runGit(['status', '--porcelain'], repo);
  const run = runProject(copyPlugin(t), repo, 'go');

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, [
    'yapus ordo repo: refused, nothing written',
    'go.mod is not at the root; run go mod init first',
    '',
  ].join('\n'));
  assert.equal(runGit(['status', '--porcelain'], repo), before);
});

test('typescript refuses in a repository set up for go and writes nothing', (t) => {
  const repo = makeTempRepo(t);
  const root = copyPlugin(t);

  commitFiles(repo, GO_FILES);
  assert.equal(runProject(root, repo, 'go').status, 0);
  commitAll(repo);

  const before = runGit(['status', '--porcelain'], repo);
  const run = runProject(root, repo, 'typescript');

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, [
    'yapus ordo repo: refused, nothing written',
    'this repository is set up for go; the person can run /ordo:repo go or ask for it',
    '',
  ].join('\n'));
  assert.equal(runGit(['status', '--porcelain'], repo), before);
});

test('an unknown language prints the usage, exits 2 and writes nothing', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['README.md', 'x']]);

  const before = runGit(['status', '--porcelain'], repo);
  const run = runProject(copyPlugin(t), repo, 'rust');

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, `${ USAGE }\n`);
  assert.equal(runGit(['status', '--porcelain'], repo), before);
});

test('refuses an upgrade whose language record is unknown and writes nothing', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.claude/yapus/ordo/version', '0.3.0'],
    [LANGUAGE_RECORD, 'rust\n'],
  ]);

  const before = runGit(['status', '--porcelain'], repo);
  const run = runProject(copyPlugin(t), repo);

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, [
    'yapus ordo repo: refused, nothing written',
    '.claude/yapus/ordo/language holds "rust", not a language; set it to typescript or go',
    '',
  ].join('\n'));
  assert.equal(runGit(['status', '--porcelain'], repo), before);
});

test('installs typescript when it is named on a fresh repository', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [['README.md', 'x']]);

  const run = runProject(copyPlugin(t), repo, 'typescript');

  assert.equal(run.status, 0, run.stderr);
  assert.equal(readRepoFile(repo, LANGUAGE_RECORD), 'typescript\n');
  assert.equal(readRepoFile(repo, OWNED), readBase('eslint.config.ts'));
});
