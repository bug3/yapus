import { spawnSync, type StdioOptions } from 'node:child_process';
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
}

export type CommitTest = { readonly passed: true } | { readonly violation: string };

// npm test runs on the commit in a worktree of its own, so the user's working
// tree and index stay as they are; the worktree borrows the repository's
// node_modules, which git does not track.
export function testCommit(commitToTest: CommitToTest): CommitTest {
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

    return runNpmTest(tree, commitToTest);
  } finally {
    // --force, because the node_modules link is an untracked file in it.
    spawnSync('git', ['worktree', 'remove', '--force', tree], gitOptions);
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runNpmTest(tree: string, { sha, env, limits }: CommitToTest): CommitTest {
  const npmTest = spawnSync('npm', ['test'], {
    cwd: tree,
    env,
    stdio: TO_STDERR,
    timeout: limits.npmTestMs,
  });
  const shortSha = sha.slice(0, SHORT_SHA_LENGTH);
  const isTimedOut = npmTest.error !== undefined && 'code' in npmTest.error
    && npmTest.error.code === 'ETIMEDOUT';

  if (isTimedOut) {
    const limitSeconds = String(limits.npmTestMs / 1000);
    const noAnswer = `npm test gave no answer within ${ limitSeconds } seconds`;

    return { violation: `${ noAnswer } on ${ shortSha }; make it faster, then push again` };
  }

  return npmTest.status === 0
    ? { passed: true }
    : { violation: `npm test failed on ${ shortSha }; fix it, then push again` };
}
