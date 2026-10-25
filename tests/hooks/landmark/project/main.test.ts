import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readTemplates } from '../../../../hooks/landmark/project/files/read-templates.ts';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { commitFiles } from './plan/commit-files.ts';
import { copyPlugin, PLUGIN, runProject } from './run-project.ts';

const OWNED = '.landmark/eslint.config.ts';
const WRAPPER = 'eslint.config.ts';

function readVersion(): unknown {
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  return isRecord(manifest) ? manifest.version : undefined;
}

function getTemplateText(target: string): string | undefined {
  return readTemplates().find((template) => template.target === target)?.text;
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
  assert.equal(readFileSync(join(repo, OWNED), 'utf8'), getTemplateText(OWNED));
  assert.equal(readFileSync(join(repo, WRAPPER), 'utf8'), getTemplateText(WRAPPER));
  assert.equal(readFileSync(join(repo, '.landmark', 'version'), 'utf8'), readVersion());
});

test('upgrade rewrites owned files and the stamp and keeps wrapper files', (t) => {
  const repo = makeTempRepo(t);
  const root = copyPlugin(t);

  commitFiles(repo, [['README.md', 'x']]);
  assert.equal(runProject(root, repo).status, 0);
  commitAll(repo);
  writeFileSync(join(repo, OWNED), 'changed owned\n');
  writeFileSync(join(repo, WRAPPER), 'changed wrapper\n');
  writeFileSync(join(repo, '.landmark', 'version'), '0.0.1');
  commitAll(repo);

  const run = runProject(root, repo);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^yapus landmark project upgrade: wrote\n/);
  assert.equal(readFileSync(join(repo, OWNED), 'utf8'), getTemplateText(OWNED));
  assert.equal(readFileSync(join(repo, WRAPPER), 'utf8'), 'changed wrapper\n');
  assert.equal(readFileSync(join(repo, '.landmark', 'version'), 'utf8'), readVersion());
  assert.doesNotMatch(run.stdout, /remove /);
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
  assert.match(run.stderr, /^yapus landmark project: crashed: [^\n]+\n$/);
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
