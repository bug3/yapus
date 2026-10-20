import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/tyler/git/get-verdict.ts';

const HOME = '/home/someone';

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
  assert.deepEqual(getVerdict({ stdinText: bashCall("stdbuf sh -c 'g''it push'"), home: HOME }), {
    kind: 'deny',
    detail: 'cannot judge a git or gh call: stdbuf runs a command the gate cannot read',
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

test('allows git reset --hard while no rule exists', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('git reset --hard'), home: HOME }), {
    kind: 'allow',
  });
});

function bashCall(command: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp' });
}
