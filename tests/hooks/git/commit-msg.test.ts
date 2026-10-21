import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';

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
const PERSON: NodeJS.ProcessEnv = { CLAUDECODE: undefined };
const VALID_MESSAGE = 'feat(hooks): add a check\n';

interface CommitMsgRun {
  readonly messageText: string;
  readonly editor: string;
  readonly who: NodeJS.ProcessEnv;
}

test('lets a commit through when its subject keeps the rule', (t) => {
  const messageRun = runCommitMsg(t, {
    messageText: VALID_MESSAGE, editor: NO_EDITOR, who: PERSON,
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
      'yapus subject: verb "fixed" is not in hooks/shared/catalogs/verbs.json; use a listed one or add it there\n',
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

  const messageRun = runCommitMsg(t, { messageText, editor: 'vi', who: PERSON });

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
    messageText: VALID_MESSAGE, editor: NO_EDITOR, who: PERSON,
  });

  assert.deepEqual(
    [messageRun.status, messageRun.stderr, messageRun.messageAfter],
    [0, '', VALID_MESSAGE],
  );
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
// the message file, as an agent or a person whatever runs the test; the
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
