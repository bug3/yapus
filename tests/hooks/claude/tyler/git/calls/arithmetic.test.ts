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

const EVALUATED = {
  kind: 'unjudgeable',
  reason: 'a word the shell evaluates as arithmetic the gate cannot read',
  shouldAlwaysDeny: true,
};

const NONE = { kind: 'calls', calls: [] };

test('refuses a substitution inside (( ))', () => {
  assert.deepEqual(callsOf('(( a[$(id)] ))'), EVALUATED);
});

test('refuses a substitution inside $(( ))', () => {
  assert.deepEqual(callsOf('echo $(( a[$(id)] ))'), EVALUATED);
});

test('refuses a parameter expansion inside (( ))', () => {
  assert.deepEqual(callsOf('(( x + ${y} ))'), EVALUATED);
});

test('does not call plain arithmetic inside (( ))', () => {
  assert.deepEqual(callsOf('(( x = 1 + 2 ))'), NONE);
});

test('refuses a backtick in an arithmetic operand of [[', () => {
  assert.deepEqual(callsOf('[[ a[`id`] -eq 1 ]]'), EVALUATED);
});

test('refuses a substitution after an arithmetic operator of [[', () => {
  assert.deepEqual(callsOf('[[ 1 -lt "$(id)" ]]'), EVALUATED);
});

test('does not call a string comparison of a substitution in [[', () => {
  assert.deepEqual(callsOf('[[ "$(id)" == x ]]'), NONE);
});

test('refuses a substitution in a let operand', () => {
  assert.deepEqual(callsOf('let "a[$(id)]"'), EVALUATED);
});

test('refuses a substitution in a zsh integer operand', () => {
  assert.deepEqual(callsOf('integer x="a[$(id)]"'), EVALUATED);
});

test('refuses a substitution in a declare -i operand', () => {
  assert.deepEqual(callsOf('declare -ri x="a[$(id)]"'), EVALUATED);
});

test('refuses a literal subscript that holds a substitution, evaluated later', () => {
  assert.deepEqual(callsOf("x='a[$(git push -f)]'; (( x ))"), {
    kind: 'unjudgeable',
    reason: 'a subscript holding a substitution the shell may evaluate later',
    shouldAlwaysDeny: true,
  });
});

test('does not call a quoted word whose subscript substitution runs now', () => {
  assert.deepEqual(callsOf('echo "a[$(date)]"'), NONE);
});

test('does not call a literal word with a substitution and no bracket before it', () => {
  assert.deepEqual(callsOf("echo '$(id) [x]'"), NONE);
});

test('does not call a literal word with a bracket and no substitution', () => {
  assert.deepEqual(callsOf("echo 'a[1] $x'"), NONE);
});

test('does not call declare without -i whose value holds a substitution', () => {
  assert.deepEqual(callsOf('declare x="$(id)"'), NONE);
});
