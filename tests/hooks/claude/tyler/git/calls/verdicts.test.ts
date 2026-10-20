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

test('denies a forced push run by git rebase -x', () => {
  assert.equal(verdictOf("git rebase -x 'git push --force' HEAD~1"), 'deny');
});

test('denies a hard reset run by git submodule foreach', () => {
  assert.equal(verdictOf("git submodule foreach 'git reset --hard'"), 'deny');
});

test('denies a hard reset run by git bisect run', () => {
  assert.equal(verdictOf('git bisect run git reset --hard'), 'deny');
});

test('denies git filter-branch', () => {
  assert.equal(verdictOf('git filter-branch --tree-filter x HEAD'), 'deny');
});

test('allows git grep with a glob after --', () => {
  assert.equal(verdictOf('git grep TODO -- *.ts'), 'allow');
});

test('denies git submodule foreach with an option that hides the command', () => {
  assert.equal(verdictOf('git submodule foreach -x git push -f'), 'deny');
});

test('denies a wrapper after xargs with no program', () => {
  assert.equal(verdictOf('echo git push -f | xargs env'), 'deny');
});

test('allows node --test before a git call', () => {
  assert.equal(verdictOf('node --test && git status'), 'allow');
});

test('allows node -v before a git call', () => {
  assert.equal(verdictOf('node -v && git status'), 'allow');
});

test('allows python3 --version before a git call', () => {
  assert.equal(verdictOf('python3 --version; git log'), 'allow');
});

test('denies python3 -v reading stdin before a git call', () => {
  assert.equal(verdictOf('echo x | python3 -v; git status'), 'deny');
});

test('denies deno run reading stdin before a git call', () => {
  assert.equal(verdictOf('echo x | deno run -; git status'), 'deny');
});

test('allows bun run of a script before a git call', () => {
  assert.equal(verdictOf('bun run build && git status'), 'allow');
});

test('denies bash reading a normalised stdin path before a git call', () => {
  assert.equal(verdictOf('bash //dev//stdin; git status'), 'deny');
});
