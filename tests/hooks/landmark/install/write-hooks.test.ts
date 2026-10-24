import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readNameList } from '../../../../hooks/landmark/install/read-name-list.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { runInstall } from './run-install.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'landmark');
const SUBPROCESS_TIMEOUT_MS = 20000;
const STUB_HEAD =
  '#!/usr/bin/env bash\nset -u\nexec bash "$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)/forward" ';
const BASH_ENTRIES: readonly string[] = [
  'run.sh', 'git/commit-msg', 'git/reference-transaction', 'git/forward',
];

test('copies the listed files into the hooks directory with the layout kept', (t) => {
  const hooks = installHooks(t);
  const files = readNameList(join(PLUGIN, 'runtime', 'landmark', 'install', 'hook-files.json'));

  assert.deepEqual(
    files.map((file) => readFileSync(join(hooks, file), 'utf8')),
    files.map((file) => readFileSync(join(PLUGIN, 'runtime', file), 'utf8')),
  );
});

test('sets mode 755 on the bash entries and the stubs', (t) => {
  const hooks = installHooks(t);
  const names = readNameList(join(PLUGIN, 'runtime', 'git', 'forward-names.json'));
  const files = [...BASH_ENTRIES, ...names.map((name) => `git/${ name }`)];

  assert.deepEqual(
    files.map((file) => statSync(join(hooks, file)).mode & 0o777),
    files.map(() => 0o755),
  );
});

test('writes one forwarding stub per name and no scopes catalog', (t) => {
  const hooks = installHooks(t);
  const names = readNameList(join(PLUGIN, 'runtime', 'git', 'forward-names.json'));

  assert.deepEqual(
    names.map((name) => readFileSync(join(hooks, 'git', name), 'utf8')),
    names.map((name) => `${ STUB_HEAD }${ name } "$@"\n`),
  );
  assert.equal(existsSync(join(hooks, 'shared', 'catalogs', 'scopes.json')), false);
});

test('runs the repository hook of its name with the arguments', (t) => {
  const hooks = installHooks(t);
  const repository = makeTempRepo(t);
  const local = join(repository, '.git', 'hooks', 'post-commit');

  writeFileSync(local, '#!/bin/sh\nexit "$1"\n', { mode: 0o755 });

  const stubRun = spawnSync(join(hooks, 'git', 'post-commit'), ['7'], {
    cwd: repository, encoding: 'utf8', env: getGitEnv(process.env), timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(stubRun.status, 7);
});

// Installs into a temporary home; returns the hooks directory.
function installHooks(t: TestContext): string {
  const { home, installRun } = runInstall(t, 'install');

  assert.equal(installRun.status, 0, installRun.stderr);

  return join(home, '.claude', 'landmark', 'hooks');
}
