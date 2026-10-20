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

test('allows noglob git status', () => {
  assert.equal(verdictOf('noglob git status'), 'allow');
});

test('denies noglob git push --force', () => {
  assert.equal(verdictOf('noglob git push --force'), 'deny');
});

test('denies repeat 1 git reset --hard', () => {
  assert.equal(verdictOf('repeat 1 git reset --hard'), 'deny');
});

test('denies arch -arm64 git push -f', () => {
  assert.equal(verdictOf('arch -arm64 git push -f origin main'), 'deny');
});

test('denies xcrun git clean -fdx', () => {
  assert.equal(verdictOf('xcrun git clean -fdx'), 'deny');
});
