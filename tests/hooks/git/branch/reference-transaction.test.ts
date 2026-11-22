import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getExclusionPath } from '../../../../hooks/shared/exclusion/get-exclusion-path.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { hasRef, makeBranchRepo } from './make-branch-repo.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const HOOK = join(ROOT, 'hooks', 'git', 'reference-transaction');
const SUBPROCESS_TIMEOUT_MS = 10000;
const BASH = execFileSync('/bin/sh', ['-c', 'command -v bash'], {
  encoding: 'utf8',
  timeout: SUBPROCESS_TIMEOUT_MS,
}).trim();
const EXECUTE_BITS = 0o111;
// A malformed line the branch check would refuse, so a pass shows Node never ran.
const MALFORMED_CREATION = '0000000000000000000000000000000000000000 x refs/heads/bad\n';
const AGENT: NodeJS.ProcessEnv = { CLAUDECODE: '1' };
const HUMAN: NodeJS.ProcessEnv = {};
// A branch name the branch check refuses, so its creation shows the check did not run.
const UNCHECKED_BRANCH = 'wip';
const OTHER_ROOT = '/nowhere/other';

interface HookRun {
  readonly state: string;
  readonly who: NodeJS.ProcessEnv;
}

interface BranchRun {
  readonly directory: string;
  readonly roots: readonly string[];
}

test('lets a transaction through at a state other than prepared', (t) => {
  const hookRun = runHook(t, { state: 'preparing', who: AGENT });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
});

test('lets a human\'s transaction through without the branch check', (t) => {
  const hookRun = runHook(t, { state: 'prepared', who: HUMAN });

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
});

test('passes an agent\'s possible branch creation to the branch check', (t) => {
  const hookRun = runHook(t, { state: 'prepared', who: AGENT });

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus branch: ref line 1 is not /);
});

test('lets an agent create a branch unchecked in a listed repository', (t) => {
  const repository = makeBranchRepo(t);

  const branchRun = runAgentBranch(t, {
    directory: repository, roots: [realpathSync(repository)],
  });

  assert.deepEqual([branchRun.status, branchRun.stderr], [0, '']);
  assert.equal(hasRef(repository, `refs/heads/${ UNCHECKED_BRANCH }`), true);
});

test('lets an agent create a branch unchecked in a listed repository\'s worktree', (t) => {
  const repository = makeBranchRepo(t);
  const worktree = join(makeTempDir(t), 'worktree');

  runGit(['worktree', 'add', '--quiet', '--detach', worktree], repository);

  const branchRun = runAgentBranch(t, {
    directory: worktree, roots: [realpathSync(repository)],
  });

  assert.deepEqual([branchRun.status, branchRun.stderr], [0, '']);
  assert.equal(hasRef(repository, `refs/heads/${ UNCHECKED_BRANCH }`), true);
});

test('refuses an agent branch in a repository the list does not hold', (t) => {
  const repository = makeBranchRepo(t);

  const branchRun = runAgentBranch(t, { directory: repository, roots: [OTHER_ROOT] });

  assert.notEqual(branchRun.status, 0);
  assert.match(branchRun.stderr, /^yapus branch: branch `wip` is not `<type>\/<slug>` /m);
  assert.equal(hasRef(repository, `refs/heads/${ UNCHECKED_BRANCH }`), false);
});

test('is executable, since git skips a hook that is not', () => {
  assert.notEqual(statSync(HOOK).mode & EXECUTE_BITS, 0);
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [HOOK], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});

// The hook run as git runs it, with the state and one ref line that would
// create refs/heads/bad; getGitEnv drops the caller's CLAUDECODE.
function runHook(t: TestContext, { state, who }: HookRun) {
  const tempDir = makeTempDir(t);

  return spawnSync(BASH, [HOOK, state], {
    cwd: tempDir,
    encoding: 'utf8',
    input: MALFORMED_CREATION,
    env: { ...getGitEnv(process.env), HOME: tempDir, TMPDIR: tempDir, ...who },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// A real git branch of UNCHECKED_BRANCH in directory through the hooks, as an
// agent, with a temporary HOME whose exclusion list holds roots.
function runAgentBranch(t: TestContext, { directory, roots }: BranchRun) {
  const home = makeTempDir(t);
  const listPath = getExclusionPath(home);

  mkdirSync(dirname(listPath), { recursive: true });
  writeFileSync(listPath, `${ JSON.stringify(roots) }\n`);

  return spawnSync('git', ['branch', UNCHECKED_BRANCH], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), HOME: home, TMPDIR: home, ...AGENT },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
