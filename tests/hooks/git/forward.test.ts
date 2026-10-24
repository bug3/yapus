import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../helpers/run-git.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', 'hooks', 'git');
const SUBPROCESS_TIMEOUT_MS = 60000;
const EXECUTABLE = 0o755;
const NOT_EXECUTABLE = 0o644;
const NOT_FORWARDED = ['commit-msg', 'reference-transaction'];

// A temporary repository whose git runs the hooks of this repository, with
// a local commit-msg hook of the given text when there is one.
function makeHookedRepo(t: TestContext, localHook?: string): string {
  const repository = makeTempRepo(t);

  runGit(['config', 'core.hooksPath', HOOKS], repository);

  if (localHook !== undefined) {
    const hookPath = join(repository, '.git', 'hooks', 'commit-msg');

    writeFileSync(hookPath, localHook, { mode: EXECUTABLE });
  }

  return repository;
}

function commit(t: TestContext, repository: string, extraEnv: NodeJS.ProcessEnv) {
  return spawnSync('git', ['commit', '--allow-empty', '-m', 'feat(hooks): add a check'], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), HOME: makeTempDir(t), TMPDIR: makeTempDir(t), ...extraEnv },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

function isWordList(list: unknown): list is string[] {
  return Array.isArray(list)
    && list.every((word) => typeof word === 'string' && /^[a-z]+(-[a-z]+)*$/.test(word));
}

function runForward(cwd: string, args: readonly string[]) {
  return spawnSync('bash', [join(HOOKS, 'forward'), ...args], {
    cwd, encoding: 'utf8', env: getGitEnv(process.env), timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

test('refuses a valid commit when the local commit-msg hook exits 1', (t) => {
  const repository = makeHookedRepo(t, '#!/bin/sh\nexit 1\n');

  assert.equal(commit(t, repository, {}).status, 1);
  assert.equal(commit(t, repository, { CLAUDECODE: '1' }).status, 1);
});

test('lets a valid commit through when the local commit-msg hook exits 0', (t) => {
  const repository = makeHookedRepo(t, '#!/bin/sh\nexit 0\n');

  assert.equal(commit(t, repository, {}).status, 0);
  assert.equal(commit(t, repository, { CLAUDECODE: '1' }).status, 0);
});

test('lets a valid commit through when there is no local hook', (t) => {
  const repository = makeHookedRepo(t);

  assert.equal(commit(t, repository, {}).status, 0);
});

test('lets a valid commit through when the local hook is not executable', (t) => {
  const repository = makeHookedRepo(t, '#!/bin/sh\nexit 1\n');

  chmodSync(join(repository, '.git', 'hooks', 'commit-msg'), NOT_EXECUTABLE);

  assert.equal(commit(t, repository, {}).status, 0);
});

test('passes the arguments to the local hook', (t) => {
  const repository = makeHookedRepo(t);
  const log = join(makeTempDir(t), 'log');

  writeFileSync(
    join(repository, '.git', 'hooks', 'post-commit'),
    `#!/bin/sh\nprintf '%s|%s' "$#" "$1" > ${ log }\n`,
    { mode: EXECUTABLE },
  );

  assert.equal(runForward(repository, ['post-commit', 'one']).status, 0);
  assert.equal(readFileSync(log, 'utf8'), '1|one');
});

test('exits 0 outside a repository', (t) => {
  assert.equal(runForward(makeTempDir(t), ['commit-msg']).status, 0);
});

test('forward-names.json is a sorted distinct list that leaves out the unforwarded hooks', () => {
  const names: unknown = JSON.parse(readFileSync(join(HOOKS, 'forward-names.json'), 'utf8'));

  assert.ok(isWordList(names));
  assert.deepEqual(names, [...new Set(names)].sort());
  assert.deepEqual(names.filter((name) => NOT_FORWARDED.includes(name)), []);
});
