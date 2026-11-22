import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getExclusionPath } from '../../../hooks/shared/exclusion/get-exclusion-path.ts';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const COMMIT_MSG = join(ROOT, 'hooks', 'git', 'commit-msg');
const SUBPROCESS_TIMEOUT_MS = 10000;
const BASH = execFileSync('/bin/sh', ['-c', 'command -v bash'], {
  encoding: 'utf8',
  timeout: SUBPROCESS_TIMEOUT_MS,
}).trim();
const EXECUTE_BITS = 0o111;
const NO_EDITOR = ':';
const SCISSORS = '# ------------------------ >8 ------------------------';
const AGENT: NodeJS.ProcessEnv = { CLAUDECODE: '1' };
// spawnSync leaves out a variable whose value is undefined.
const HUMAN: NodeJS.ProcessEnv = { CLAUDECODE: undefined };
const VALID_MESSAGE = 'feat(hooks): add a check\n';
// A subject the check refuses, so a pass shows the check did not run.
const UNCHECKED_MESSAGE = 'update the readme\n';
const REFUSING_HOOK = '#!/bin/sh\nexit 1\n';

interface CommitMsgRun {
  readonly messageText: string;
  readonly editor: string;
  readonly who: NodeJS.ProcessEnv;
}

interface AgentCommitMsgRun {
  readonly directory: string;
  readonly listText: string;
}

test('lets a commit through when its subject keeps the rule', (t) => {
  const messageRun = runCommitMsg(t, {
    messageText: VALID_MESSAGE, editor: NO_EDITOR, who: HUMAN,
  });

  assert.deepEqual([messageRun.status, messageRun.stderr], [0, '']);
});

test('refuses a commit whose verb is not in the catalog', (t) => {
  const messageRun = runCommitMsg(t, {
    messageText: 'fix(hooks): fixed it\n', editor: NO_EDITOR, who: AGENT,
  });

  assert.deepEqual(
    [messageRun.status, messageRun.stderr, messageRun.messageAfter],
    [
      2,
      'yapus subject: verb "fixed" is not in hooks/shared/catalogs/verbs.json; use a listed one\n',
      'fix(hooks): fixed it\n',
    ],
  );
});

test('lets a commit through that git commit -v wrote with an editor', (t) => {
  const messageText = [
    'feat(hooks): add a check',
    '# Please enter the commit message for your changes.',
    SCISSORS,
    'diff --git a/x b/x',
    '',
  ].join('\n');

  const messageRun = runCommitMsg(t, { messageText, editor: 'vi', who: HUMAN });

  assert.deepEqual([messageRun.status, messageRun.stderr], [0, '']);
});

test('adds the trailers to an agent message that keeps the rule', (t) => {
  const messageRun = runCommitMsg(t, {
    messageText: VALID_MESSAGE, editor: NO_EDITOR, who: AGENT,
  });

  assert.deepEqual(
    [messageRun.status, messageRun.stderr, messageRun.messageAfter],
    [
      0,
      '',
      'feat(hooks): add a check\n\nAssisted-by: Claude Code\nCo-authored-by: yapus <noreply@yapus.dev>\n',
    ],
  );
});

test('leaves the message of a commit without CLAUDECODE as it is', (t) => {
  const messageRun = runCommitMsg(t, {
    messageText: VALID_MESSAGE, editor: NO_EDITOR, who: HUMAN,
  });

  assert.deepEqual(
    [messageRun.status, messageRun.stderr, messageRun.messageAfter],
    [0, '', VALID_MESSAGE],
  );
});

test('lets an agent commit through with no check or trailer in a listed repository', (t) => {
  const repository = makeTempRepo(t);

  const messageRun = runAgentCommitMsg(t, {
    directory: repository, listText: makeListText(repository),
  });

  assert.deepEqual(
    [messageRun.status, messageRun.stderr, messageRun.messageAfter],
    [0, '', UNCHECKED_MESSAGE],
  );
});

test('lets an agent commit through with no check or trailer in a listed worktree', (t) => {
  const repository = makeTempRepo(t);

  const messageRun = runAgentCommitMsg(t, {
    directory: makeLinkedWorktree(t, repository), listText: makeListText(repository),
  });

  assert.deepEqual(
    [messageRun.status, messageRun.stderr, messageRun.messageAfter],
    [0, '', UNCHECKED_MESSAGE],
  );
});

test('stops a commit by the repository\'s own commit-msg hook in a listed repository', (t) => {
  const repository = makeTempRepo(t);

  addRefusingHook(repository);

  const messageRun = runAgentCommitMsg(t, {
    directory: repository, listText: makeListText(repository),
  });

  assert.deepEqual([messageRun.status, messageRun.messageAfter], [1, UNCHECKED_MESSAGE]);
});

test('stops a commit by the main checkout\'s own commit-msg hook in a listed worktree', (t) => {
  const repository = makeTempRepo(t);
  const worktree = makeLinkedWorktree(t, repository);

  addRefusingHook(repository);

  const messageRun = runAgentCommitMsg(t, {
    directory: worktree, listText: makeListText(repository),
  });

  assert.deepEqual([messageRun.status, messageRun.messageAfter], [1, UNCHECKED_MESSAGE]);
});

test('checks the subject in a listed repository when the list is not JSON', (t) => {
  const repository = makeTempRepo(t);

  const messageRun = runAgentCommitMsg(t, { directory: repository, listText: '[' });

  assert.equal(messageRun.status, 2);
  assert.match(messageRun.stderr, /^yapus subject: /);
});

test('is executable, since git skips a hook that is not', () => {
  assert.notEqual(statSync(COMMIT_MSG).mode & EXECUTE_BITS, 0);
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [COMMIT_MSG], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});

// The hook run as git runs it: from the repository root, with the path of
// the message file, as an agent or a human whatever runs the test; the
// message file as the hook left it.
function runCommitMsg(t: TestContext, { messageText, editor, who }: CommitMsgRun) {
  const tempDir = makeTempDir(t);
  const messageFile = join(tempDir, 'COMMIT_EDITMSG');

  writeFileSync(messageFile, messageText);

  const hookRun = spawnSync(BASH, [COMMIT_MSG, messageFile], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, GIT_EDITOR: editor, HOME: tempDir, TMPDIR: tempDir, ...who },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { ...hookRun, messageAfter: readFileSync(messageFile, 'utf8') };
}

// The hook run as git runs it in directory, as an agent, with UNCHECKED_MESSAGE
// and a temporary HOME whose exclusion list is listText; the message file as
// the hook left it.
function runAgentCommitMsg(t: TestContext, { directory, listText }: AgentCommitMsgRun) {
  const home = makeTempDir(t);
  const listPath = getExclusionPath(home);
  const messageFile = join(home, 'COMMIT_EDITMSG');

  mkdirSync(dirname(listPath), { recursive: true });
  writeFileSync(listPath, listText);
  writeFileSync(messageFile, UNCHECKED_MESSAGE);

  const hookRun = spawnSync(BASH, [COMMIT_MSG, messageFile], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), GIT_EDITOR: NO_EDITOR, HOME: home, TMPDIR: home, ...AGENT },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { ...hookRun, messageAfter: readFileSync(messageFile, 'utf8') };
}

// The exclusion list that holds the repository's real root.
function makeListText(repository: string): string {
  return `${ JSON.stringify([realpathSync(repository)]) }\n`;
}

// A linked worktree of the repository at its first commit.
function makeLinkedWorktree(t: TestContext, repository: string): string {
  const worktree = join(makeTempDir(t), 'worktree');

  runGit(['commit', '--quiet', '--allow-empty', '-m', 'feat(hooks): add a check'], repository);
  runGit(['worktree', 'add', '--quiet', '--detach', worktree], repository);

  return worktree;
}

// The repository's own commit-msg hook, which refuses every commit.
function addRefusingHook(repository: string): void {
  const hook = join(repository, '.git', 'hooks', 'commit-msg');

  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, REFUSING_HOOK);
  chmodSync(hook, 0o755);
}
