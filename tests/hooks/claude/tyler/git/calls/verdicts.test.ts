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

test('denies exported GIT_CONFIG variables before a git call', () => {
  assert.equal(
    verdictOf(
      'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath ' +
        'GIT_CONFIG_VALUE_0=/dev/null; git commit -m x',
    ),
    'deny',
  );
});

test('denies a standalone GIT_CONFIG assignment before a git call', () => {
  assert.equal(verdictOf('GIT_CONFIG_VALUE_0=/dev/null; git commit -m x'), 'deny');
});

test('denies unset of a GIT_CONFIG variable before a git call', () => {
  assert.equal(verdictOf('unset GIT_CONFIG_COUNT; git commit -m x'), 'deny');
});

test('denies env -u of a GIT_CONFIG variable on a git call', () => {
  assert.equal(verdictOf('env -u GIT_CONFIG_COUNT git commit -m x'), 'deny');
});

test('allows GIT_EDITOR=true on git rebase --continue', () => {
  assert.equal(verdictOf('GIT_EDITOR=true git rebase --continue'), 'allow');
});

test('allows GIT_PAGER=cat on git log', () => {
  assert.equal(verdictOf('GIT_PAGER=cat git log'), 'allow');
});

test('allows PAGER=cat on git diff', () => {
  assert.equal(verdictOf('PAGER=cat git diff'), 'allow');
});

test('denies GIT_SEQUENCE_EDITOR set to a program on git rebase', () => {
  assert.equal(verdictOf("GIT_SEQUENCE_EDITOR='sed -i x' git rebase -i HEAD~2"), 'deny');
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

test('denies sudo before a git call', () => {
  assert.equal(verdictOf('sudo git commit -m x'), 'deny');
});

test('denies sudo before a shell that runs git', () => {
  assert.equal(verdictOf("sudo bash -c 'git commit -m x'"), 'deny');
});

test('denies env -i before a shell string the gate cannot read', () => {
  assert.equal(verdictOf('env -i bash -c "$X"'), 'deny');
});

test('denies env -i before a shell that runs git status', () => {
  assert.equal(verdictOf("env -i bash -c 'git status'"), 'deny');
});

test('allows sudo before a runner on a line that does not mention git', () => {
  assert.equal(verdictOf('sudo find /tmp -name x'), 'allow');
});

test('denies a forced push in a shell string run as argv by git submodule foreach', () => {
  assert.equal(verdictOf("git submodule foreach bash -c 'git push -f'"), 'deny');
});

test('denies a forced push in one word run by git submodule foreach', () => {
  assert.equal(verdictOf("git submodule foreach 'git push --force'"), 'deny');
});

test('denies a hard reset in one word run by git bisect run', () => {
  assert.equal(verdictOf("git bisect run 'git reset --hard'"), 'deny');
});

test('denies a hard reset in the joined words of git bisect run', () => {
  assert.equal(verdictOf("git bisect run echo 'x; git reset --hard'"), 'deny');
});
