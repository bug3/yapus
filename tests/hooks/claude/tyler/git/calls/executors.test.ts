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

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

const NONE = { kind: 'calls', calls: [] };

test('refuses xargs whatever its words', () => {
  assert.deepEqual(
    callsOf('xargs wc -l'),
    unjudgeable('xargs runs a command the gate cannot read', false),
  );
});

test('refuses parallel whatever its words', () => {
  assert.deepEqual(
    callsOf('parallel echo ::: a'),
    unjudgeable('parallel runs a command the gate cannot read', false),
  );
});

test('refuses watch whatever its words', () => {
  assert.deepEqual(
    callsOf('watch ls'),
    unjudgeable('watch runs a command the gate cannot read', false),
  );
});

test('refuses ssh whatever its words', () => {
  assert.deepEqual(
    callsOf('ssh host ls'),
    unjudgeable('ssh runs a command the gate cannot read', false),
  );
});

test('refuses script whatever its words', () => {
  assert.deepEqual(
    callsOf('script -q /dev/null'),
    unjudgeable('script runs a command the gate cannot read', false),
  );
});

test('refuses flock whatever its words', () => {
  assert.deepEqual(
    callsOf('flock /tmp/l -c ls'),
    unjudgeable('flock runs a command the gate cannot read', false),
  );
});

test('refuses busybox whatever its words', () => {
  assert.deepEqual(
    callsOf('busybox ls'),
    unjudgeable('busybox runs a command the gate cannot read', false),
  );
});

test('refuses su whatever its words', () => {
  assert.deepEqual(
    callsOf('su -c ls'),
    unjudgeable('su runs a command the gate cannot read', false),
  );
});

test('refuses runuser whatever its words', () => {
  assert.deepEqual(
    callsOf('runuser -u u ls'),
    unjudgeable('runuser runs a command the gate cannot read', false),
  );
});

test('refuses nsenter whatever its words', () => {
  assert.deepEqual(
    callsOf('nsenter -t 1 ls'),
    unjudgeable('nsenter runs a command the gate cannot read', false),
  );
});

test('refuses unshare whatever its words', () => {
  assert.deepEqual(
    callsOf('unshare -r ls'),
    unjudgeable('unshare runs a command the gate cannot read', false),
  );
});

test('refuses firejail whatever its words', () => {
  assert.deepEqual(
    callsOf('firejail ls'),
    unjudgeable('firejail runs a command the gate cannot read', false),
  );
});

test('refuses systemd-run whatever its words', () => {
  assert.deepEqual(
    callsOf('systemd-run ls'),
    unjudgeable('systemd-run runs a command the gate cannot read', false),
  );
});

test('refuses at whatever its words', () => {
  assert.deepEqual(
    callsOf('at now'),
    unjudgeable('at runs a command the gate cannot read', false),
  );
});

test('refuses batch whatever its words', () => {
  assert.deepEqual(
    callsOf('batch'),
    unjudgeable('batch runs a command the gate cannot read', false),
  );
});

test('refuses an executor by its path in upper case', () => {
  assert.deepEqual(
    callsOf('/usr/bin/XARGS ls'),
    unjudgeable('xargs runs a command the gate cannot read', false),
  );
});

test('refuses an executor behind a wrapper', () => {
  assert.deepEqual(
    callsOf('sudo xargs ls'),
    unjudgeable('xargs runs a command the gate cannot read', false),
  );
});

test('refuses a line whose git call feeds xargs', () => {
  assert.deepEqual(
    callsOf('git ls-files | xargs wc -l'),
    unjudgeable('xargs runs a command the gate cannot read', false),
  );
});

test('refuses find -exec', () => {
  assert.deepEqual(
    callsOf('find . -exec git checkout -- . \\;'),
    unjudgeable('find runs a command the gate cannot read', false),
  );
});

test('refuses find -execdir', () => {
  assert.deepEqual(
    callsOf('find . -execdir ls +'),
    unjudgeable('find runs a command the gate cannot read', false),
  );
});

test('refuses find -ok', () => {
  assert.deepEqual(
    callsOf('find . -ok ls \\;'),
    unjudgeable('find runs a command the gate cannot read', false),
  );
});

test('refuses find -okdir', () => {
  assert.deepEqual(
    callsOf('find . -okdir ls \\;'),
    unjudgeable('find runs a command the gate cannot read', false),
  );
});

test('refuses find with an opaque word, which may be an action', () => {
  assert.deepEqual(
    callsOf('find . $ACTION'),
    unjudgeable('find runs a command the gate cannot read', false),
  );
});

test('does not call a plain find', () => {
  assert.deepEqual(callsOf('find . -name x'), NONE);
});
