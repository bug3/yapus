import assert from 'node:assert/strict';
import {
  existsSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  testCommit, type CommitTest, type Limits,
} from '../../../../hooks/git/push/test-commit.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { listWorktrees } from './list-worktrees.ts';
import { FAILING_TEST, makeNpmRepo, type NpmRepo, PASSING_TEST } from './make-npm-repo.ts';
import { waitUntil } from './wait-until.ts';

const LIMITS = { gitSeconds: 10, npmTestSeconds: 30 };
const MISSING_SHA = 'dddddddddddddddddddddddddddddddddddddddd';
const SLEEPING_TEST = 'sleep 30';
// Starts a sleeping grandchild that writes its pid to PID_FILE, then sleeps.
const GRANDCHILD_TEST = 'sleep 30 & echo $! > "$PID_FILE"; sleep 30';
const WAIT_MS = 10000;
const UNABORTED = new AbortController().signal;

interface CommitRun {
  readonly limits: Limits;
  readonly signal: AbortSignal;
  readonly extraEnv: NodeJS.ProcessEnv;
}

test('passes a commit whose npm test passes and leaves no worktree', async (t) => {
  const npmRepo = makeNpmRepo(t, PASSING_TEST);

  assert.deepEqual(await runTestCommit(t, npmRepo), {
    commitTest: { passed: true },
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('refuses a commit whose npm test fails and leaves no worktree', async (t) => {
  const npmRepo = makeNpmRepo(t, FAILING_TEST);

  assert.deepEqual(await runTestCommit(t, npmRepo), {
    commitTest: {
      violation: `npm test failed on ${ npmRepo.sha.slice(0, 12) }; fix it, then push again`,
    },
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('refuses a repository without node_modules and leaves no worktree', async (t) => {
  const npmRepo = makeNpmRepo(t, PASSING_TEST);

  rmSync(join(npmRepo.repository, 'node_modules'), { recursive: true });

  assert.deepEqual(await runTestCommit(t, npmRepo), {
    commitTest: { violation: 'no node_modules in the repository; run npm ci, then push again' },
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('refuses a sha the repository does not have and leaves no worktree', async (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);

  assert.deepEqual(await runTestCommit(t, { repository, sha: MISSING_SHA }), {
    commitTest: { violation: 'git could not make the worktree; the push is blocked, retry it' },
    worktrees: [realpathSync(repository)],
    tempEntries: [],
  });
});

test('stops npm test on its time limit and leaves no worktree', async (t) => {
  const npmRepo = makeNpmRepo(t, SLEEPING_TEST);
  const sentinel = join(npmRepo.repository, 'node_modules', 'sentinel');
  const limits = { gitSeconds: 10, npmTestSeconds: 1 };

  writeFileSync(sentinel, '');

  const commitRun = await runTestCommit(t, npmRepo, { limits, signal: UNABORTED, extraEnv: {} });

  assert.deepEqual([commitRun, existsSync(sentinel)], [
    {
      commitTest: {
        violation: `npm test gave no answer within 1 seconds on ${
          npmRepo.sha.slice(0, 12) }; make it faster, then push again`,
      },
      worktrees: [realpathSync(npmRepo.repository)],
      tempEntries: [],
    },
    true,
  ]);
});

test('kills the whole npm test on an abort and leaves no worktree', async (t) => {
  const npmRepo = makeNpmRepo(t, GRANDCHILD_TEST);
  const pidFile = join(makeTempDir(t), 'pid');
  const sentinel = join(npmRepo.repository, 'node_modules', 'sentinel');
  const controller = new AbortController();

  writeFileSync(sentinel, '');

  const commitRun = runTestCommit(t, npmRepo, {
    limits: LIMITS, signal: controller.signal, extraEnv: { PID_FILE: pidFile },
  });

  const isPidWritten = await waitUntil(() => existsSync(pidFile), WAIT_MS);

  controller.abort();
  assert.ok(isPidWritten, 'npm test wrote no grandchild pid file within the wait');

  assert.deepEqual([await commitRun, await isGone(pidFile), existsSync(sentinel)], [
    {
      commitTest: {
        violation: `the push test was interrupted on ${
          npmRepo.sha.slice(0, 12) }; push again to test it`,
      },
      worktrees: [realpathSync(npmRepo.repository)],
      tempEntries: [],
    },
    true,
    true,
  ]);
});

// A killed process can linger as a zombie until its new parent reaps it.
async function isGone(pidFile: string): Promise<boolean> {
  const pid = Number(readFileSync(pidFile, 'utf8'));

  return waitUntil(() => !isAlive(pid), WAIT_MS);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

async function runTestCommit(
  t: TestContext,
  { repository, sha }: NpmRepo,
  { limits, signal, extraEnv }: CommitRun = { limits: LIMITS, signal: UNABORTED, extraEnv: {} },
): Promise<{
  commitTest: CommitTest;
  worktrees: string[];
  tempEntries: string[];
}> {
  const tempParent = makeTempDir(t);
  // The hook's own TMPDIR is its temporary parent; npm keeps a compile cache
  // in TMPDIR, which the tests check is left empty, so the cache is off.
  const env = {
    ...getGitEnv(process.env),
    HOME: makeTempDir(t),
    TMPDIR: tempParent,
    NODE_DISABLE_COMPILE_CACHE: '1',
    npm_config_update_notifier: 'false',
    ...extraEnv,
  };

  const commitTest = await testCommit({ repository, sha, env, tempParent, limits, signal });

  return {
    commitTest,
    worktrees: listWorktrees(repository),
    tempEntries: readdirSync(tempParent),
  };
}
