import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCalls } from '../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function callsOf(line: string): unknown {
  const split = splitCommands(line, undefined);

  if (split.kind === 'failure') {
    throw new Error(split.reason);
  }

  return getCalls(split.items, undefined);
}

function gitCall(...texts: readonly string[]): unknown {
  return {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: texts.map((text) => ({ text, isOpaque: false })),
        configs: [],
        assignments: [],
      },
    ],
  };
}

function unjudgeable(reason: string): unknown {
  return { kind: 'unjudgeable', reason };
}

const SCRIPT = 'a shell reading a script or stdin the gate cannot read';
const NONE = { kind: 'calls', calls: [] };

test('reads the string of bash -c', () => {
  assert.deepEqual(callsOf("bash -c 'git reset --hard'"), gitCall('reset', '--hard'));
});

test('reads the string of a combined option group with c', () => {
  assert.deepEqual(callsOf('bash -lc "git push --force"'), gitCall('push', '--force'));
});

test('reads the string after a shell option that takes a value', () => {
  assert.deepEqual(callsOf("bash -o pipefail -c 'git push'"), gitCall('push'));
});

test('refuses a shell string it cannot read', () => {
  assert.deepEqual(
    callsOf('sh -c "$X"'),
    unjudgeable('a shell string the gate cannot read'),
  );
});

test('refuses a shell string that does not split', () => {
  assert.deepEqual(callsOf("sh -c 'git push)'"), unjudgeable('unmatched )'));
});

test('refuses a shell that runs a script file', () => {
  assert.deepEqual(callsOf('zsh script.sh'), unjudgeable(SCRIPT));
});

test('refuses a shell that reads a pipe', () => {
  assert.deepEqual(callsOf("echo 'git push' | bash"), unjudgeable(SCRIPT));
});

test('refuses a shell that reads a heredoc', () => {
  assert.deepEqual(callsOf('bash <<EOF\ngit push\nEOF'), unjudgeable(SCRIPT));
});

test('refuses a shell that reads a redirection', () => {
  assert.deepEqual(callsOf('sh < x'), unjudgeable(SCRIPT));
});

test('refuses source', () => {
  assert.deepEqual(callsOf('source env.sh'), unjudgeable(SCRIPT));
});

test('refuses a dot command', () => {
  assert.deepEqual(callsOf('. env.sh'), unjudgeable(SCRIPT));
});

test('refuses xargs that is given a shell', () => {
  assert.deepEqual(
    callsOf("xargs /bin/BASH -c '{}'"),
    unjudgeable('xargs runs a command the gate cannot read'),
  );
});

test('refuses find that is given a shell', () => {
  assert.deepEqual(
    callsOf("find . -exec sh -c 'x' \\;"),
    unjudgeable('find runs a command the gate cannot read'),
  );
});

test('does not refuse ssh for a shell name among its words', () => {
  assert.deepEqual(callsOf('ssh host bash'), NONE);
});

test('reads env -S as a command line', () => {
  assert.deepEqual(callsOf("env -S 'git push --force'"), gitCall('push', '--force'));
});

test('puts the words after the env -S string behind its words', () => {
  assert.deepEqual(callsOf("env -S 'git push' --force"), gitCall('push', '--force'));
});

test('refuses an env -S string it cannot read', () => {
  assert.deepEqual(
    callsOf('env -S "$X"'),
    unjudgeable('a shell string the gate cannot read'),
  );
});

test('reads eval with bare words', () => {
  assert.deepEqual(callsOf('eval git reset --hard'), gitCall('reset', '--hard'));
});

test('reads eval with one string', () => {
  assert.deepEqual(callsOf('eval "git reset --hard"'), gitCall('reset', '--hard'));
});

test('refuses eval of an opaque value', () => {
  assert.deepEqual(
    callsOf('eval $X'),
    unjudgeable('eval of a value the gate cannot read'),
  );
});

test('refuses xargs that runs git', () => {
  assert.deepEqual(
    callsOf('xargs git branch -D'),
    unjudgeable('xargs runs a command the gate cannot read'),
  );
});

test('refuses find -exec of git', () => {
  assert.deepEqual(
    callsOf('find . -exec git checkout -- . \\;'),
    unjudgeable('find runs a command the gate cannot read'),
  );
});

test('refuses ssh that runs git', () => {
  assert.deepEqual(
    callsOf('ssh host git push'),
    unjudgeable('ssh runs a command the gate cannot read'),
  );
});

test('refuses setsid that runs git', () => {
  assert.deepEqual(
    callsOf('setsid git push'),
    unjudgeable('setsid runs a command the gate cannot read'),
  );
});

test('does not call xargs that runs another program', () => {
  assert.deepEqual(callsOf('xargs echo'), NONE);
});

test('refuses a git word held inside a longer word', () => {
  assert.deepEqual(
    callsOf("xargs sh -c 'git push'"),
    unjudgeable('xargs runs a command the gate cannot read'),
  );
});

test('refuses an executor given an opaque word', () => {
  assert.deepEqual(
    callsOf('ssh $HOST ls'),
    unjudgeable('ssh runs a command the gate cannot read'),
  );
});

test('reads two nested strings', () => {
  assert.deepEqual(callsOf('bash -c "bash -c \\"git push\\""'), gitCall('push'));
});

test('refuses a third nested string', () => {
  assert.deepEqual(
    callsOf('bash -c "bash -c \\"bash -c \'git push\'\\""'),
    unjudgeable('commands nested too deep'),
  );
});
