import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getVerdict,
} from
  '../../../../../hooks/claude/tyler/git/get-verdict.ts';
import {
  bypassCatalog,
} from
  '../../../../../hooks/claude/tyler/git/rules/bypass/bypass-catalog.ts';
import {
  destructiveCommands,
} from
  '../../../../../hooks/claude/tyler/git/rules/destructive/destructive-commands.ts';
import { pushCatalog } from '../../../../../hooks/claude/tyler/git/rules/push/push-catalog.ts';

const HOME = '/home/someone';

test('denies a forced push in a compound line', () => {
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('git add . && git push --force origin main'), home: HOME }),
    { kind: 'deny', detail: pushCatalog.reasons.force },
  );
  assert.deepEqual(getVerdict({ stdinText: bashCall('git push origin +main'), home: HOME }), {
    kind: 'deny',
    detail: pushCatalog.reasons.forceRefspec,
  });
});

test('allows a lease push that checks it includes the remote', () => {
  assert.deepEqual(
    getVerdict({
      stdinText: bashCall('git push --force-with-lease --force-if-includes origin feat/x'),
      home: HOME,
    }),
    { kind: 'allow' },
  );
});
const RESET_REASON = destructiveCommands.resetHard.reason;

test('allows a tool other than Bash', () => {
  const stdinText = JSON.stringify({ tool_name: 'Read', tool_input: {} });

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), { kind: 'allow' });
});

test('denies a payload that is not JSON', () => {
  assert.deepEqual(getVerdict({ stdinText: 'nope', home: HOME }), {
    kind: 'deny',
    detail: 'cannot read the tool call: stdin is not JSON',
  });
});

test('denies a command it cannot split when the text mentions git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall("git 'push"), home: HOME }), {
    kind: 'deny',
    detail: 'cannot read the command: unterminated single quote',
  });
});

test('allows a command it cannot split when the text does not mention git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall("echo 'oops"), home: HOME }), {
    kind: 'allow',
  });
});

test('denies a call it cannot judge when the text mentions git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall("echo 'git push' | bash"), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: '
      + 'a shell reading a script or stdin the gate cannot read',
  });
});

test('denies a call it cannot judge when quotes hide git from the raw text', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall("xargs sh -c 'g''it push'"), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: xargs runs a command the gate cannot read',
  });
});

test('denies a call it cannot judge when only a comment mentions git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('bash ./build.sh # git'), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: '
      + 'a shell reading a script or stdin the gate cannot read',
  });
});

test('denies a call it cannot judge when a heredoc body mentions git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('bash <<E\ngit push\nE\n'), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: '
      + 'a shell reading a script or stdin the gate cannot read',
  });
});

test('allows a call it cannot judge when the text does not mention git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('bash ./build.sh'), home: HOME }), {
    kind: 'allow',
  });
});

test('allows a plain git status', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('git status'), home: HOME }), {
    kind: 'allow',
  });
});

test('allows git checkout -- file', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('git checkout -- file'), home: HOME }), {
    kind: 'allow',
  });
});

test('denies git reset --hard', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('git reset --hard'), home: HOME }), {
    kind: 'deny',
    detail: RESET_REASON,
  });
});

test('denies git reset --hard in an if condition', () => {
  const stdinText = bashCall('if git reset --hard; then :; fi');

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), { kind: 'deny', detail: RESET_REASON });
});

test('denies a negated git reset --hard', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('! git reset --hard'), home: HOME }), {
    kind: 'deny',
    detail: RESET_REASON,
  });
});

test('denies git branch -D in a for body', () => {
  const stdinText = bashCall('for b in x; do git branch -D x; done');

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), {
    kind: 'deny',
    detail: destructiveCommands.branchDelete.reason,
  });
});

test('denies git clean -f behind env -C', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('env -C /tmp git clean -f'), home: HOME }), {
    kind: 'deny',
    detail: destructiveCommands.cleanForce.reason,
  });
});

test('denies git reset --hard inside bash -lc', () => {
  const stdinText = bashCall("bash -lc 'git reset --hard'");

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), { kind: 'deny', detail: RESET_REASON });
});

test('denies git stash clear inside a command substitution', () => {
  const stdinText = bashCall('echo "$(git stash clear)"');

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), {
    kind: 'deny',
    detail: destructiveCommands.stashClear.reason,
  });
});

test('denies an opaque program even when the text does not mention git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('$CMD push --force'), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: a program name the gate cannot read',
  });
});

test('denies the ways to skip the git hooks', () => {
  const { reasons } = bypassCatalog;

  assert.deepEqual(getVerdict({ stdinText: bashCall('git commit -n -m x'), home: HOME }), {
    kind: 'deny',
    detail: reasons.noVerifyCommit,
  });
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('git -c core.hooksPath=/dev/null push'), home: HOME }),
    { kind: 'deny', detail: reasons.hooksPath },
  );
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('GIT_CONFIG_COUNT=1 git push'), home: HOME }),
    { kind: 'deny', detail: reasons.configEnvironment },
  );
});

test('allows a commit whose message only reads like a skip', () => {
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('git commit -m "--no-verify"'), home: HOME }),
    { kind: 'allow' },
  );
});

function bashCall(command: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp' });
}
