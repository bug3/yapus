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

function gitCall(assignments: readonly string[], ...texts: readonly string[]): unknown {
  return {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: texts.map((text) => ({ text, isOpaque: false })),
        configs: [],
        assignments,
      },
    ],
  };
}

const UNREADABLE = {
  kind: 'unjudgeable',
  reason: 'a wrapper argument the gate cannot read',
};

test('treats a path to env as a wrapper', () => {
  assert.deepEqual(callsOf('/usr/bin/env -i git push'), gitCall([], 'push'));
});

test('treats a wrapper in upper case as a wrapper', () => {
  assert.deepEqual(callsOf('SUDO git push'), gitCall([], 'push'));
});

test('refuses an opaque value of nice -n', () => {
  assert.deepEqual(callsOf('nice -n $N git push'), UNREADABLE);
});

test('refuses an opaque timeout duration', () => {
  assert.deepEqual(callsOf('timeout $D git push'), UNREADABLE);
});

test('refuses an opaque value of sudo -u', () => {
  assert.deepEqual(callsOf('sudo -u $U git push'), UNREADABLE);
});

test('refuses an opaque value of env -u', () => {
  assert.deepEqual(callsOf('env -u $X git push'), UNREADABLE);
});

test('refuses an opaque word where the program starts after a wrapper', () => {
  assert.deepEqual(callsOf('sudo $CMD push'), UNREADABLE);
});

test('refuses an opaque program word after the timeout duration', () => {
  assert.deepEqual(callsOf('timeout 10 $CMD push'), UNREADABLE);
});

test('refuses an opaque program word after env assignments', () => {
  assert.deepEqual(callsOf('env A=1 $CMD push'), UNREADABLE);
});

test('allows an assignment with an opaque value after a wrapper', () => {
  assert.deepEqual(callsOf('sudo A=$X git push'), gitCall(['A'], 'push'));
});

test('records an append assignment', () => {
  assert.deepEqual(callsOf('A+=x git push'), gitCall(['A'], 'push'));
});

test('records an indexed assignment', () => {
  assert.deepEqual(callsOf('A[1]=x git push'), gitCall(['A'], 'push'));
});

test('records an env assignment whose name is not a plain name', () => {
  assert.deepEqual(callsOf('env 1x=y git push'), gitCall(['1x'], 'push'));
});

test('records an env append assignment by its name', () => {
  assert.deepEqual(callsOf('env A+=x B[1]=y git push'), gitCall(['A', 'B'], 'push'));
});

test('refuses an env word with an opaque name before the equals sign', () => {
  assert.deepEqual(callsOf('env $N=1 git push'), UNREADABLE);
});

test('skips coproc', () => {
  assert.deepEqual(callsOf('coproc git push'), gitCall([], 'push'));
});
