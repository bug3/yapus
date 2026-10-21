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

const ALLOW = { kind: 'allow' };

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

test('denies a git command the gate does not know, which may be an alias', () => {
  const verdict = getVerdict({ stdinText: bashCall('git nuke'), home: HOME });

  assert.equal(verdict.kind, 'deny');
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
  const stdinText = bashCall("parallel sh -c 'g''it push'");

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: parallel runs a command the gate cannot read',
  });
});

test('denies a call it cannot judge when only a comment mentions git', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('bash # git'), home: HOME }), {
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
  assert.deepEqual(getVerdict({ stdinText: bashCall('echo x | python3'), home: HOME }), {
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

test('denies a badly named new branch and allows a well named one', () => {
  const stdinText = bashCall('git fetch && git checkout -b wip');
  const badName = getVerdict({ stdinText, home: HOME });

  assert.equal(badName.kind, 'deny');
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('git checkout -b feat/x'), home: HOME }),
    { kind: 'allow' },
  );
});

test('denies git remote set-head in a compound line', () => {
  const stdinText = bashCall('git fetch && git remote set-head origin x');

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), {
    kind: 'deny',
    detail: destructiveCommands.remoteSetHead.reason,
  });
});

test('denies an unquoted variable in git remote add but allows a quoted one', () => {
  const unquoted = getVerdict({ stdinText: bashCall('git remote add origin $URL'), home: HOME });

  assert.equal(unquoted.kind, 'deny');
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('git remote add origin "$URL"'), home: HOME }),
    ALLOW,
  );
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

test('allows a test command before a git-free command', () => {
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('[ -f package.json ] && npm test'), home: HOME }),
    { kind: 'allow' },
  );
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('if [ -n "$x" ]; then echo y; fi'), home: HOME }),
    { kind: 'allow' },
  );
});

test('allows the git information options', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('git --version'), home: HOME }), ALLOW);
  assert.deepEqual(getVerdict({ stdinText: bashCall('git --help'), home: HOME }), ALLOW);
});

test('allows a git command line that feeds xargs', () => {
  const stdinText = bashCall('git diff --name-only | xargs wc -l');

  assert.deepEqual(getVerdict({ stdinText, home: HOME }), ALLOW);
});

test('allows a git status after a script run by a shell or by source', () => {
  const shell = bashCall('bash ./build.sh && git status');
  const source = bashCall('source .venv/bin/activate && git status');

  assert.deepEqual(getVerdict({ stdinText: shell, home: HOME }), ALLOW);
  assert.deepEqual(getVerdict({ stdinText: source, home: HOME }), ALLOW);
});

test('allows git after an interpreter running a script or only options', () => {
  const module = bashCall('python3 -m pytest -x && git status');
  const script = bashCall('node server.js -p 3000; git status');
  const options = bashCall('node --test && git status');
  const version = bashCall('python3 --version; git log');

  assert.deepEqual(getVerdict({ stdinText: module, home: HOME }), ALLOW);
  assert.deepEqual(getVerdict({ stdinText: script, home: HOME }), ALLOW);
  assert.deepEqual(getVerdict({ stdinText: options, home: HOME }), ALLOW);
  assert.deepEqual(getVerdict({ stdinText: version, home: HOME }), ALLOW);
});

test('denies xargs that replaces arguments of a git call', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('xargs -I{} git push -f {}'), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: xargs replaces arguments the gate cannot read',
  });
});

test('denies a shell reading git from stdin', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall("echo 'git push' | bash"), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: '
      + 'a shell reading a script or stdin the gate cannot read',
  });
});

test('denies an interpreter reading stdin on a line that mentions git', () => {
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('echo x | python3; git status'), home: HOME }),
    {
      kind: 'deny',
      detail: 'cannot judge a git or gh call: python3 runs code the gate cannot read',
    },
  );
});

test('denies a pull request created without a draft or a subject title', () => {
  const verdict = getVerdict({
    stdinText: bashCall('gh pr create --title "Add a check" --body-file /tmp/b.md'),
    home: HOME,
  });

  assert.equal(verdict.kind, 'deny');
  assert.match('detail' in verdict ? verdict.detail : '', /^the title of `gh pr create`/);
});

test('denies a pull request create whose output truncates its body file', () => {
  const verdict = getVerdict({
    stdinText: bashCall('gh pr create -d -t "feat(hooks): add a check" -F /tmp/b.md > /tmp/b.md'),
    home: HOME,
  });

  assert.equal(verdict.kind, 'deny');
  assert.match('detail' in verdict ? verdict.detail : '', /^run `gh pr create` on a line/);
});

test('denies an issue created with a title out of the issue form', () => {
  const verdict = getVerdict({
    stdinText: bashCall('gh issue create --title "Add a check" --body-file /tmp/b.md'),
    home: HOME,
  });

  assert.equal(verdict.kind, 'deny');
  assert.match('detail' in verdict ? verdict.detail : '', /^the title "Add a check" of `gh issue/);
});

test('denies a gh command with an option before its action', () => {
  const verdict = getVerdict({ stdinText: bashCall('gh repo -R o/r delete x'), home: HOME });

  assert.equal(verdict.kind, 'deny');
  assert.match('detail' in verdict ? verdict.detail : '', /^the word after `gh repo`/);
});

test('denies a squash merge and allows a merge commit', () => {
  const squash = getVerdict({ stdinText: bashCall('gh pr merge 3 -sd'), home: HOME });

  assert.equal(squash.kind, 'deny');
  assert.match('detail' in squash ? squash.detail : '', /^`gh pr merge --squash`/);
  assert.deepEqual(getVerdict({ stdinText: bashCall('gh pr merge 3 -md'), home: HOME }), ALLOW);
});

test('denies a gh api write and a label change', () => {
  const post = getVerdict({ stdinText: bashCall('gh api -X POST /x'), home: HOME });
  const label = getVerdict({ stdinText: bashCall('gh label create x'), home: HOME });

  assert.equal(post.kind, 'deny');
  assert.match('detail' in post ? post.detail : '', /^`gh api` with a method other than GET/);
  assert.equal(label.kind, 'deny');
  assert.match('detail' in label ? label.detail : '', /^`gh label create` changes labels/);
});

test('allows a gh api read with a quoted endpoint', () => {
  assert.deepEqual(
    getVerdict({ stdinText: bashCall('gh api -X GET "repos/o/$R" --paginate'), home: HOME }),
    ALLOW,
  );
});

test('allows a gh api call that starts with an option', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('gh api -H x /user'), home: HOME }), ALLOW);
});

test('denies a pull request create on a line that writes its body file', () => {
  const line = "cat > /tmp/b.md <<'EOF'\nx\nEOF\n"
    + 'gh pr create -d -t "feat(hooks): add a check" -F /tmp/b.md';
  const verdict = getVerdict({ stdinText: bashCall(line), home: HOME });

  assert.equal(verdict.kind, 'deny');
  assert.match('detail' in verdict ? verdict.detail : '', /^run `gh pr create` on a line/);
});

test('denies an opaque script of source or a shell', () => {
  const detail = 'cannot judge a git or gh call: '
    + 'a shell reading a script or stdin the gate cannot read';

  assert.deepEqual(getVerdict({ stdinText: bashCall('source "$X"'), home: HOME }), {
    kind: 'deny',
    detail,
  });
  assert.deepEqual(getVerdict({ stdinText: bashCall('bash $SCRIPT'), home: HOME }), {
    kind: 'deny',
    detail,
  });
});

function bashCall(command: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp' });
}
