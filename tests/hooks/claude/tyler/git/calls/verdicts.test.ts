import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVerdict } from '../../../../../../hooks/claude/tyler/git/get-verdict.ts';

function verdictOf(command: string): string {
  const stdinText = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  return getVerdict({ stdinText, home: '/home/someone' }).kind;
}

test('allows git -C with a quoted variable', () => {
  assert.equal(verdictOf('git -C "$dir" log'), 'allow');
});

test('denies git -C with an unquoted variable', () => {
  assert.equal(verdictOf('git -C $dir log'), 'deny');
});
