import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { listWorktrees } from './list-worktrees.ts';
import { CLEAN_ENV_TEST, FAILING_TEST, makeNpmRepo, PASSING_TEST } from './make-npm-repo.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const MAIN = join(ROOT, 'hooks', 'git', 'push', 'main.ts');
const SUBPROCESS_TIMEOUT_MS = 60000;
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const DELETION_LINE =
  '(delete) 0000000000000000000000000000000000000000 refs/heads/old 1111111111111111111111111111111111111111\n';

test('exits 0 when npm test passes, without the outer repository variables', (t) => {
  const { repository, sha } = makeNpmRepo(t, CLEAN_ENV_TEST);

  const pushRun = runMain(t, repository, makePushLine(sha));

  assert.deepEqual(
    [pushRun.status, pushRun.stdout, listWorktrees(repository)],
    [0, '', [realpathSync(repository)]],
  );
});

test('leaves the index and the working tree of the repository as they were', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);

  writeFileSync(join(repository, 'package.json'), '{}\n');
  writeFileSync(join(repository, 'staged.md'), 'staged\n');
  runGit(['add', 'staged.md'], repository);
  const before = getRepositoryState(repository);

  runMain(t, repository, makePushLine(sha));

  assert.deepEqual(
    [getRepositoryState(repository), listWorktrees(repository)],
    [before, [realpathSync(repository)]],
  );
});

test('exits 0 without running npm test for a push that only deletes', (t) => {
  const { repository } = makeNpmRepo(t, FAILING_TEST);

  const pushRun = runMain(t, repository, DELETION_LINE);

  assert.deepEqual(
    [pushRun.status, pushRun.stderr, listWorktrees(repository)],
    [0, '', [realpathSync(repository)]],
  );
});

test('exits 2 with one line for a malformed push line', (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);

  const pushRun = runMain(t, repository, 'refs/heads/main\n');

  assert.deepEqual(
    [pushRun.status, pushRun.stderr, listWorktrees(repository)],
    [
      2,
      'yapus push: push line 1 is not "<local ref> <local sha> <remote ref> <remote sha>"; the push is blocked, retry it\n',
      [realpathSync(repository)],
    ],
  );
});

test('exits 2 with one line when the hook crashes on a line separator', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);
  const tempDir = makeTempDir(t);
  const tempFile = join(tempDir, `a${ LINE_SEPARATOR }file`);
  const extraEnv = { TMPDIR: tempFile };

  writeFileSync(tempFile, '');

  const pushRun = runMainWithEnv(t, { repository, stdinText: makePushLine(sha), extraEnv });

  assert.deepEqual(
    [pushRun.status, pushRun.stderr],
    [
      2,
      `yapus push: crashed: ENOTDIR: not a directory, mkdtemp '${ tempDir }/a<U+2028>file/yapus-push-XXXXXX'; the push is blocked, fix the hook\n`,
    ],
  );
});

function makePushLine(sha: string): string {
  return `refs/heads/main ${ sha } refs/heads/main 1111111111111111111111111111111111111111\n`;
}

function getRepositoryState(repository: string): string[] {
  return [runGit(['write-tree'], repository), runGit(['status', '--porcelain'], repository)];
}

interface MainRun {
  readonly repository: string;
  readonly stdinText: string;
  readonly extraEnv: NodeJS.ProcessEnv;
}

// The program run as the hook runs it, at the work tree root, with the
// variables an outer hook in a linked worktree could leave behind.
function runMain(t: TestContext, repository: string, stdinText: string) {
  return runMainWithEnv(t, { repository, stdinText, extraEnv: {} });
}

function runMainWithEnv(t: TestContext, { repository, stdinText, extraEnv }: MainRun) {
  const tempDir = makeTempDir(t);

  return spawnSync(process.execPath, [MAIN], {
    cwd: repository,
    encoding: 'utf8',
    env: {
      ...getGitEnv(process.env),
      HOME: tempDir,
      GIT_DIR: join(repository, '.git'),
      GIT_INDEX_FILE: join(tempDir, 'index'),
      npm_config_update_notifier: 'false',
      ...extraEnv,
    },
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
