import assert from 'node:assert/strict';
import { readdirSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { testCommit, type CommitTest } from '../../../../hooks/git/push/test-commit.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';
import { listWorktrees } from './list-worktrees.ts';
import { FAILING_TEST, makeNpmRepo, type NpmRepo, PASSING_TEST } from './make-npm-repo.ts';

const LIMITS = { gitMs: 10000, npmTestMs: 30000 };
const MISSING_SHA = 'dddddddddddddddddddddddddddddddddddddddd';

test('passes a commit whose npm test passes and leaves no worktree', (t) => {
  const npmRepo = makeNpmRepo(t, PASSING_TEST);

  assert.deepEqual(runTestCommit(t, npmRepo), {
    commitTest: { passed: true },
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('refuses a commit whose npm test fails and leaves no worktree', (t) => {
  const npmRepo = makeNpmRepo(t, FAILING_TEST);

  assert.deepEqual(runTestCommit(t, npmRepo), {
    commitTest: {
      violation: `npm test failed on ${ npmRepo.sha.slice(0, 12) }; fix it, then push again`,
    },
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('refuses a repository without node_modules and leaves no worktree', (t) => {
  const npmRepo = makeNpmRepo(t, PASSING_TEST);

  rmSync(join(npmRepo.repository, 'node_modules'), { recursive: true });

  assert.deepEqual(runTestCommit(t, npmRepo), {
    commitTest: { violation: 'no node_modules in the repository; run npm ci, then push again' },
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('refuses a sha the repository does not have and leaves no worktree', (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);

  assert.deepEqual(runTestCommit(t, { repository, sha: MISSING_SHA }), {
    commitTest: { violation: 'git could not make the worktree; the push is blocked, retry it' },
    worktrees: [realpathSync(repository)],
    tempEntries: [],
  });
});

function runTestCommit(t: TestContext, { repository, sha }: NpmRepo): {
  commitTest: CommitTest;
  worktrees: string[];
  tempEntries: string[];
} {
  const tempParent = makeTempDir(t);
  const env = {
    ...getGitEnv(process.env),
    HOME: makeTempDir(t),
    npm_config_update_notifier: 'false',
  };

  const commitTest = testCommit({ repository, sha, env, tempParent, limits: LIMITS });

  return {
    commitTest,
    worktrees: listWorktrees(repository),
    tempEntries: readdirSync(tempParent),
  };
}
