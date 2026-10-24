import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { makeEnv, runInstall } from './run-install.ts';

const SUBPROCESS_TIMEOUT_MS = 60000;
const TRAILERS = join(
  import.meta.dirname, '..', '..', '..', '..', 'hooks', 'git', 'trailer', 'trailers.json',
);
const COMMIT = ['commit', '--allow-empty', '-m'];

interface Setup {
  readonly home: string;
  readonly repository: string;
}

test('commits a valid subject with exactly the two trailers of the catalog', (t) => {
  const setup = installAndInit(t);

  assert.equal(runGit(setup, [...COMMIT, 'feat(src): add greet']).status, 0);
  assert.deepEqual(
    runGit(setup, ['log', '-1', '--format=%(trailers:only,unfold)']).stdout.trim().split('\n'),
    JSON.parse(readFileSync(TRAILERS, 'utf8')),
  );
});

test('refuses a subject whose verb is not in the catalog', (t) => {
  const commitRun = runGit(installAndInit(t), [...COMMIT, 'added stuff']);

  assert.equal(commitRun.status, 1);
  assert.match(commitRun.stderr, /^yapus subject: /m);
});

test('refuses to create a branch for an agent', (t) => {
  const setup = installAndInit(t);

  runGit(setup, [...COMMIT, 'feat(src): add greet']);

  const branchRun = runGit(setup, ['branch', 'foo']);

  assert.notEqual(branchRun.status, 0);
  assert.match(branchRun.stderr, /^yapus branch: /m);
});

test('refuses a scope the repository catalog does not list', (t) => {
  const setup = installAndInit(t);

  mkdirSync(join(setup.repository, '.landmark'));
  writeFileSync(join(setup.repository, '.landmark', 'scopes.json'), '["src"]\n');

  const commitRun = runGit(setup, [...COMMIT, 'feat(xyz): add greet']);

  assert.notEqual(commitRun.status, 0);
  assert.match(commitRun.stderr, /^yapus subject: /m);
});

test('lets any word scope through when the repository has no catalog', (t) => {
  const commitRun = runGit(installAndInit(t), [...COMMIT, 'feat(xyz): add greet']);

  assert.equal(commitRun.status, 0, commitRun.stderr);
});

test('lets a merge git writes through with and without an agent', (t) => {
  assert.deepEqual([mergeStatus(t, true), mergeStatus(t, false)], [0, 0]);
});

// A real git revert does not run commit-msg, so the subject goes through a commit.
test('lets a revert subject through with and without an agent', (t) => {
  const args = [...COMMIT, 'Revert "x"'];
  const setup = installAndInit(t);

  assert.deepEqual(
    [runGit(setup, args).status, runGit(setup, args, false).status],
    [0, 0],
  );
});

test('stops a commit the repository commit-msg hook refuses, agent or not', (t) => {
  const setup = installAndInit(t);
  const args = [...COMMIT, 'feat(src): add greet'];

  writeFileSync(
    join(setup.repository, '.git', 'hooks', 'commit-msg'),
    '#!/bin/sh\nexit 1\n',
    { mode: 0o755 },
  );

  assert.deepEqual(
    [runGit(setup, args).status, runGit(setup, args, false).status],
    [1, 1],
  );
});

// The exit status of a real git merge (the editor is a no-op, as git runs the commit-msg hook
// only on an edited message) --no-ff of a side branch.
function mergeStatus(t: TestContext, isAgent: boolean): number | null {
  const setup = installAndInit(t);

  runGit(setup, [...COMMIT, 'feat(src): add greet'], false);
  runGit(setup, ['switch', '-c', 'x'], false);
  runGit(setup, [...COMMIT, 'feat(src): add side'], false);
  runGit(setup, ['switch', '-'], false);

  return runGit(
    setup, ['-c', 'core.editor=true', 'merge', '--no-ff', '--edit', 'x'], isAgent,
  ).status;
}

// Installs from a copy of the plugin into a temporary home; returns a new repository.
function installAndInit(t: TestContext): Setup {
  const { home, installRun } = runInstall(t, 'install');

  assert.equal(installRun.status, 0, installRun.stderr);

  return { home, repository: makeTempRepo(t) };
}

// git in the repository under the home's global config; an agent's call by default.
function runGit(setup: Setup, args: readonly string[], isAgent = true) {
  return spawnSync('git', args, {
    cwd: setup.repository,
    encoding: 'utf8',
    env: makeEnv(setup.home, isAgent ? { CLAUDECODE: '1' } : {}),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
