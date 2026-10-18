import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { listWorktrees } from './list-worktrees.ts';
import {
  CLEAN_ENV_TEST, FAILING_TEST, makeNpmRepo, type NpmRepo, PASSING_TEST,
} from './make-npm-repo.ts';
import { waitUntil } from './wait-until.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const MAIN = join(ROOT, 'hooks', 'git', 'push', 'main.ts');
const SUBPROCESS_TIMEOUT_MS = 60000;
const WAIT_MS = 10000;
const SLEEPING_TEST = 'sleep 30';
// A locked worktree makes a single git worktree remove --force refuse.
const LOCKING_TEST = 'git worktree lock "$PWD"';
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const DELETION_LINE =
  '(delete) 0000000000000000000000000000000000000000 refs/heads/old 1111111111111111111111111111111111111111\n';

test('exits 0 when npm test passes, without the outer repository variables', (t) => {
  const { repository, sha } = makeNpmRepo(t, CLEAN_ENV_TEST);

  const pushRun = runMain(t, repository, makePushLine(sha));

  assert.deepEqual(
    [pushRun.status, pushRun.stdout, listWorktrees(repository), pushRun.tempEntries],
    [0, '', [realpathSync(repository)], []],
  );
});

test('leaves the index and the working tree of the repository as they were', (t) => {
  const { repository, sha } = makeNpmRepo(t, PASSING_TEST);

  writeFileSync(join(repository, 'package.json'), '{}\n');
  writeFileSync(join(repository, 'staged.md'), 'staged\n');
  runGit(['add', 'staged.md'], repository);
  const before = getRepositoryState(repository);

  const pushRun = runMain(t, repository, makePushLine(sha));
  const violationLines = pushRun.stderr
    .split('\n')
    .filter((line) => line.startsWith('yapus push:'));

  assert.deepEqual(
    [
      pushRun.status,
      violationLines,
      getRepositoryState(repository),
      listWorktrees(repository),
      pushRun.tempEntries,
    ],
    [0, [], before, [realpathSync(repository)], []],
  );
});

test('exits 0 without running npm test for a push that only deletes', (t) => {
  const { repository } = makeNpmRepo(t, FAILING_TEST);

  const pushRun = runMain(t, repository, DELETION_LINE);

  assert.deepEqual(
    [pushRun.status, pushRun.stderr, listWorktrees(repository), pushRun.tempEntries],
    [0, '', [realpathSync(repository)], []],
  );
});

test('exits 2 with one line for a malformed push line', (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);

  const pushRun = runMain(t, repository, 'refs/heads/main\n');

  assert.deepEqual(
    [pushRun.status, pushRun.stderr, listWorktrees(repository), pushRun.tempEntries],
    [
      2,
      'yapus push: push line 1 is not "<local ref> <local sha> <remote ref> <remote sha>"; the push is blocked, retry it\n',
      [realpathSync(repository)],
      [],
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

test('exits 2 and removes the worktree on SIGINT', async (t) => {
  const npmRepo = makeNpmRepo(t, SLEEPING_TEST);

  assert.deepEqual(await interruptMain(t, npmRepo, 'SIGINT'), {
    status: 2,
    lastLine: `yapus push: the push test was interrupted on ${
      npmRepo.sha.slice(0, 12) }; push again to test it`,
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('exits 2 and removes the worktree on SIGTERM', async (t) => {
  const npmRepo = makeNpmRepo(t, SLEEPING_TEST);

  assert.deepEqual(await interruptMain(t, npmRepo, 'SIGTERM'), {
    status: 2,
    lastLine: `yapus push: the push test was interrupted on ${
      npmRepo.sha.slice(0, 12) }; push again to test it`,
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('exits 2 and removes the worktree on SIGHUP', async (t) => {
  const npmRepo = makeNpmRepo(t, SLEEPING_TEST);

  assert.deepEqual(await interruptMain(t, npmRepo, 'SIGHUP'), {
    status: 2,
    lastLine: `yapus push: the push test was interrupted on ${
      npmRepo.sha.slice(0, 12) }; push again to test it`,
    worktrees: [realpathSync(npmRepo.repository)],
    tempEntries: [],
  });
});

test('writes a line when it cannot remove its worktree', (t) => {
  const { repository, sha } = makeNpmRepo(t, LOCKING_TEST);

  const pushRun = runMain(t, repository, makePushLine(sha));
  const lockedTree = listWorktrees(repository)[1] ?? '';

  runGit(['worktree', 'unlock', lockedTree], repository);
  runGit(['worktree', 'prune'], repository);

  assert.deepEqual(
    [pushRun.status, pushRun.tempEntries, listWorktrees(repository).length],
    [0, [], 1],
  );
  assert.match(
    pushRun.stderr.split('\n').at(-2) ?? '',
    /^yapus push: could not remove the worktree (\S+\/yapus-push-\w+\/tree); run git worktree unlock \1 if it is locked, then git worktree prune$/,
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
// variables an outer hook in a linked worktree could leave behind, and what
// it left in its own TMPDIR.
function runMain(t: TestContext, repository: string, stdinText: string) {
  const tempParent = makeTempDir(t);
  const pushRun = runMainWithEnv(t, { repository, stdinText, extraEnv: { TMPDIR: tempParent } });

  return { ...pushRun, tempEntries: readdirSync(tempParent) };
}

function runMainWithEnv(t: TestContext, { repository, stdinText, extraEnv }: MainRun) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: repository,
    encoding: 'utf8',
    env: makeMainEnv(t, repository, extraEnv),
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// The program sent the signal once npm test runs in its worktree, and what it
// left behind.
async function interruptMain(
  t: TestContext,
  { repository, sha }: NpmRepo,
  signal: NodeJS.Signals,
) {
  const tempParent = makeTempDir(t);
  const pushRun = spawn(process.execPath, [MAIN], {
    cwd: repository,
    env: makeMainEnv(t, repository, { TMPDIR: tempParent }),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
  const stderrText = text(pushRun.stderr);
  const closing = new Promise<number | null>((resolve) => {
    pushRun.once('close', resolve);
  });

  pushRun.stdin.end(makePushLine(sha));
  const isTreeMade = await waitUntil(() => listWorktrees(repository).length === 2, WAIT_MS);

  pushRun.kill(signal);
  assert.ok(isTreeMade, 'the push test made no worktree within the wait');

  return {
    status: await closing,
    lastLine: (await stderrText).split('\n').at(-2),
    worktrees: listWorktrees(repository),
    tempEntries: readdirSync(tempParent),
  };
}

function makeMainEnv(t: TestContext, repository: string, extraEnv: NodeJS.ProcessEnv) {
  const tempDir = makeTempDir(t);

  // npm keeps a compile cache in TMPDIR, which a test checks is left empty.
  return {
    ...getGitEnv(process.env),
    HOME: tempDir,
    GIT_DIR: join(repository, '.git'),
    GIT_INDEX_FILE: join(tempDir, 'index'),
    NODE_DISABLE_COMPILE_CACHE: '1',
    npm_config_update_notifier: 'false',
    ...extraEnv,
  };
}
