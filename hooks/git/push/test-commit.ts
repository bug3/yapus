import { spawn, spawnSync, type StdioOptions } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

// The children's output is diagnostics, so both streams go to stderr (C5).
const TO_STDERR: StdioOptions = ['ignore', 2, 2];
const SHORT_SHA_LENGTH = 12;

export interface Limits {
  readonly gitMs: number;
  readonly npmTestMs: number;
}

export interface CommitToTest {
  readonly repository: string;
  readonly sha: string;
  readonly env: NodeJS.ProcessEnv;
  readonly tempParent: string;
  readonly limits: Limits;
  readonly signal: AbortSignal;
}

export type CommitTest = { readonly passed: true } | { readonly violation: string };

type NpmTestEnd = 'passed' | 'failed' | 'timedOut' | 'interrupted';

// npm test runs on the commit in a worktree of its own, so the user's working
// tree and index stay as they are; the worktree borrows the repository's
// node_modules, which git does not track.
export async function testCommit(commitToTest: CommitToTest): Promise<CommitTest> {
  const { repository, sha, env, tempParent, limits } = commitToTest;
  const nodeModules = join(repository, 'node_modules');

  if (!existsSync(nodeModules)) {
    return { violation: 'no node_modules in the repository; run npm ci, then push again' };
  }

  const tempDir = mkdtempSync(join(tempParent, 'yapus-push-'));
  const tree = join(tempDir, 'tree');
  const gitOptions = { cwd: repository, env, stdio: TO_STDERR, timeout: limits.gitMs };

  try {
    const worktreeAdd = spawnSync(
      'git',
      ['worktree', 'add', '--detach', '--quiet', tree, sha],
      gitOptions,
    );

    if (worktreeAdd.status !== 0) {
      return { violation: 'git could not make the worktree; the push is blocked, retry it' };
    }

    symlinkSync(nodeModules, join(tree, 'node_modules'));

    return await runNpmTest(tree, commitToTest);
  } finally {
    // --force, because the node_modules link is an untracked file in it.
    spawnSync('git', ['worktree', 'remove', '--force', tree], gitOptions);
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function runNpmTest(tree: string, commitToTest: CommitToTest): Promise<CommitTest> {
  const { sha, limits } = commitToTest;
  const shortSha = sha.slice(0, SHORT_SHA_LENGTH);
  const npmTestEnd = await waitForNpmTest(tree, commitToTest);

  switch (npmTestEnd) {
    case 'passed':
      return { passed: true };

    case 'failed':
      return { violation: `npm test failed on ${ shortSha }; fix it, then push again` };

    case 'timedOut': {
      const limitSeconds = String(limits.npmTestMs / 1000);
      const noAnswer = `npm test gave no answer within ${ limitSeconds } seconds`;

      return { violation: `${ noAnswer } on ${ shortSha }; make it faster, then push again` };
    }

    case 'interrupted':
      return { violation: `the push test was interrupted on ${ shortSha }` };
  }
}

// npm test runs in a process group of its own, so that a time limit or an
// interrupt kills the processes its script starts as well as npm.
function waitForNpmTest(
  tree: string,
  { env, limits, signal }: CommitToTest,
): Promise<NpmTestEnd> {
  const npmTest = spawn('npm', ['test'], { cwd: tree, env, stdio: TO_STDERR, detached: true });

  return new Promise((resolve) => {
    let stopReason: NpmTestEnd | undefined;
    const stop = (reason: NpmTestEnd): void => {
      stopReason ??= reason;
      killGroup(npmTest.pid);
    };
    const onAbort = (): void => {
      stop('interrupted');
    };
    const timer = setTimeout(stop, limits.npmTestMs, 'timedOut');
    const settle = (npmTestEnd: NpmTestEnd): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(stopReason ?? npmTestEnd);
    };

    signal.addEventListener('abort', onAbort, { once: true });

    if (signal.aborted) {
      onAbort();
    }

    npmTest.once('error', () => {
      settle('failed');
    });
    npmTest.once('close', (code) => {
      settle(code === 0 ? 'passed' : 'failed');
    });
  });
}

// The group can be gone already when npm ends as the limit passes.
function killGroup(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Nothing is left to kill.
  }
}
