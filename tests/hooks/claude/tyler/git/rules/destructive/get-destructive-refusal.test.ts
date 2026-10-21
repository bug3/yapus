import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  destructiveCommands,
} from
  '../../../../../../../hooks/claude/tyler/git/rules/destructive/destructive-commands.ts';
import {
  getDestructiveRefusal,
} from
  '../../../../../../../hooks/claude/tyler/git/rules/destructive/get-destructive-refusal.ts';

function gitCall(...texts: readonly string[]): Call {
  return {
    tool: 'git',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function opaqueCall(...texts: readonly string[]): Call {
  const call = gitCall(...texts);

  return { ...call, words: [...call.words, { text: '$X', isOpaque: true, canSplit: true }] };
}

function quotedCall(...texts: readonly string[]): Call {
  const call = gitCall(...texts);

  return { ...call, words: [...call.words, { text: '$X', isOpaque: true, canSplit: false }] };
}

function ghCall(...texts: readonly string[]): Call {
  return { ...gitCall(...texts), tool: 'gh' };
}

const OPAQUE_RESET = 'cannot judge `git reset` with an argument the gate cannot read'
  + '; quote it if it is one word, and start it with neither - nor +';

test('refuses git reset --hard', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('reset', '--hard')),
    destructiveCommands.resetHard.reason,
  );
});

test('refuses a long option written as an unambiguous prefix', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('reset', '--har')),
    destructiveCommands.resetHard.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('clean', '--forc')),
    destructiveCommands.cleanForce.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('branch', '--del', '--forc', 'x')),
    destructiveCommands.branchDelete.reason,
  );
});

test('passes a long option that only shares a beginning with a refused one', () => {
  assert.equal(getDestructiveRefusal(gitCall('reset', '--hardly')), undefined);
});

test('refuses git reset --hard with a revision', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('reset', '--hard', 'HEAD~1')),
    destructiveCommands.resetHard.reason,
  );
});

test('allows git reset --soft', () => {
  assert.equal(getDestructiveRefusal(gitCall('reset', '--soft', 'HEAD~1')), undefined);
});

test('refuses git clean -f', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('clean', '-f')),
    destructiveCommands.cleanForce.reason,
  );
});

test('refuses git clean --force', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('clean', '--force')),
    destructiveCommands.cleanForce.reason,
  );
});

test('refuses git clean with f inside a short group', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('clean', '-fdx')),
    destructiveCommands.cleanForce.reason,
  );
});

test('allows git clean -n', () => {
  assert.equal(getDestructiveRefusal(gitCall('clean', '-n')), undefined);
});

test('allows git clean -nd', () => {
  assert.equal(getDestructiveRefusal(gitCall('clean', '-nd')), undefined);
});

test('refuses git checkout .', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '.')),
    destructiveCommands.checkoutPathspec.reason,
  );
});

test('refuses git checkout -- .', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '--', '.')),
    destructiveCommands.checkoutPathspec.reason,
  );
});

test('refuses git checkout with the pathspec :/', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', ':/')),
    destructiveCommands.checkoutPathspec.reason,
  );
});

test('refuses git checkout with the pathspec *', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '--', '*')),
    destructiveCommands.checkoutPathspec.reason,
  );
});

test('allows git checkout -- file', () => {
  assert.equal(getDestructiveRefusal(gitCall('checkout', '--', 'file')), undefined);
});

test('allows git checkout main', () => {
  assert.equal(getDestructiveRefusal(gitCall('checkout', 'main')), undefined);
});

test('refuses git restore .', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('restore', '.')),
    destructiveCommands.restorePathspec.reason,
  );
});

test('refuses git restore -W .', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('restore', '-W', '.')),
    destructiveCommands.restorePathspec.reason,
  );
});

test('refuses git restore --staged --worktree .', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('restore', '--staged', '--worktree', '.')),
    destructiveCommands.restorePathspec.reason,
  );
});

test('refuses git restore -SW .', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('restore', '-SW', '.')),
    destructiveCommands.restorePathspec.reason,
  );
});

test('allows git restore --staged .', () => {
  assert.equal(getDestructiveRefusal(gitCall('restore', '--staged', '.')), undefined);
});

test('allows git restore -S .', () => {
  assert.equal(getDestructiveRefusal(gitCall('restore', '-S', '.')), undefined);
});

test('allows git restore file', () => {
  assert.equal(getDestructiveRefusal(gitCall('restore', 'file')), undefined);
});

test('refuses git branch -D', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('branch', '-D', 'x')),
    destructiveCommands.branchDelete.reason,
  );
});

test('refuses git branch -d -f', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('branch', '-d', '-f', 'x')),
    destructiveCommands.branchDelete.reason,
  );
});

test('refuses git branch --delete --force', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('branch', '--delete', '--force', 'x')),
    destructiveCommands.branchDelete.reason,
  );
});

test('refuses git branch -df', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('branch', '-df', 'x')),
    destructiveCommands.branchDelete.reason,
  );
});

test('refuses git branch -fd', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('branch', '-fd', 'x')),
    destructiveCommands.branchDelete.reason,
  );
});

test('allows git branch -d', () => {
  assert.equal(getDestructiveRefusal(gitCall('branch', '-d', 'x')), undefined);
});

test('allows git branch --delete', () => {
  assert.equal(getDestructiveRefusal(gitCall('branch', '--delete', 'x')), undefined);
});

test('allows git branch -f without a delete flag', () => {
  assert.equal(getDestructiveRefusal(gitCall('branch', '-f', 'x', 'HEAD')), undefined);
});

test('refuses git stash drop', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('stash', 'drop')),
    destructiveCommands.stashDrop.reason,
  );
});

test('refuses git stash clear', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('stash', 'clear')),
    destructiveCommands.stashClear.reason,
  );
});

test('allows git stash pop', () => {
  assert.equal(getDestructiveRefusal(gitCall('stash', 'pop')), undefined);
});

test('refuses gh repo delete', () => {
  assert.equal(
    getDestructiveRefusal(ghCall('repo', 'delete')),
    destructiveCommands.ghRepoDelete.reason,
  );
});

test('refuses gh repo delete whatever its other words', () => {
  assert.equal(
    getDestructiveRefusal(ghCall('repo', 'delete', 'owner/name', '--yes')),
    destructiveCommands.ghRepoDelete.reason,
  );
});

test('allows gh repo view', () => {
  assert.equal(getDestructiveRefusal(ghCall('repo', 'view')), undefined);
});

test('allows git status', () => {
  assert.equal(getDestructiveRefusal(gitCall('status')), undefined);
});

test('refuses an opaque argument of git reset', () => {
  assert.equal(getDestructiveRefusal(opaqueCall('reset')), OPAQUE_RESET);
});

test('names the subcommand when refusing an opaque argument', () => {
  assert.equal(
    getDestructiveRefusal(opaqueCall('stash')),
    'cannot judge `git stash` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('refuses an opaque argument of git branch', () => {
  assert.equal(
    getDestructiveRefusal(opaqueCall('branch', '-d')),
    'cannot judge `git branch` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('allows an opaque argument of git log', () => {
  assert.equal(getDestructiveRefusal(opaqueCall('log')), undefined);
});

test('allows an opaque argument of gh repo view', () => {
  assert.equal(getDestructiveRefusal({ ...opaqueCall('repo', 'view'), tool: 'gh' }), undefined);
});

test('refuses a whole-tree pathspec spelled with dots and slashes', () => {
  const { reason } = destructiveCommands.checkoutPathspec;

  assert.equal(getDestructiveRefusal(gitCall('checkout', './')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', './.')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', './/')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', '--', './')), reason);
});

test('refuses a pathspec with magic', () => {
  const { reason } = destructiveCommands.checkoutPathspec;

  assert.equal(getDestructiveRefusal(gitCall('checkout', ':(top)')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', ':!x')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', ':/.')), reason);
});

test('refuses a pathspec that climbs out with a parent component', () => {
  const { reason } = destructiveCommands.checkoutPathspec;

  assert.equal(getDestructiveRefusal(gitCall('checkout', '..')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', '../x')), reason);
  assert.equal(getDestructiveRefusal(gitCall('checkout', 'a/../..')), reason);
});

test('refuses a pathspec read from a file in any form', () => {
  const { reason } = destructiveCommands.checkoutPathspec;

  assert.equal(getDestructiveRefusal(gitCall('checkout', '--pathspec-from-file=x')), reason);
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '--pathspec-from-file', 'x')),
    reason,
  );
  assert.equal(getDestructiveRefusal(gitCall('checkout', '--pathspec-from')), reason);
});

test('allows a plain directory or file pathspec', () => {
  assert.equal(getDestructiveRefusal(gitCall('checkout', 'src/')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('checkout', '--', 'src/')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('checkout', 'a.ts')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('restore', './src')), undefined);
});

test('refuses git restore of the whole tree with any option beyond the index ones', () => {
  const { reason } = destructiveCommands.restorePathspec;

  assert.equal(getDestructiveRefusal(gitCall('restore', '--worktree', '.')), reason);
  assert.equal(getDestructiveRefusal(gitCall('restore', '--staged', '-s', 'HEAD~1', '.')), reason);
  assert.equal(getDestructiveRefusal(gitCall('restore', '--staged', '--source=x', '.')), reason);
  assert.equal(getDestructiveRefusal(gitCall('restore', '--staged', '--no-staged', '.')), reason);
  assert.equal(getDestructiveRefusal(gitCall('restore', '-q', '.')), reason);
  assert.equal(
    getDestructiveRefusal(gitCall('restore', '--staged', '--pathspec-from-file=x')),
    reason,
  );
});

test('allows git restore of the whole tree with only index options', () => {
  assert.equal(getDestructiveRefusal(gitCall('restore', '--staged', '-q', '.')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('restore', '-Sq', '.')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('restore', '--staged', '--quiet', ':/')), undefined);
});

test('refuses git checkout and git switch with a force option', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '-f', 'main')),
    destructiveCommands.checkoutForce.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '--force', 'main')),
    destructiveCommands.checkoutForce.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('switch', '-f', 'main')),
    destructiveCommands.switchForce.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('switch', '--discard-changes', 'main')),
    destructiveCommands.switchForce.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('switch', '--discard', 'main')),
    destructiveCommands.switchForce.reason,
  );
});

test('allows git checkout and git switch without a force option', () => {
  assert.equal(getDestructiveRefusal(gitCall('checkout', 'main')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('checkout', '--', 'src/')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('switch', 'main')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('switch', '-c', 'x')), undefined);
});

test('refuses git update-ref with a delete option', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('update-ref', '-d', 'refs/heads/x')),
    destructiveCommands.updateRefDelete.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('update-ref', '--delete', 'refs/heads/x')),
    destructiveCommands.updateRefDelete.reason,
  );
});

test('allows git update-ref without a delete option', () => {
  assert.equal(getDestructiveRefusal(gitCall('update-ref', 'refs/heads/x', 'HEAD')), undefined);
});

test('refuses gh api with the DELETE method in every form', () => {
  const { reason } = destructiveCommands.ghApiDelete;

  assert.equal(getDestructiveRefusal(ghCall('api', '-X', 'DELETE', 'repos/x/y')), reason);
  assert.equal(getDestructiveRefusal(ghCall('api', '-XDELETE', 'repos/x/y')), reason);
  assert.equal(getDestructiveRefusal(ghCall('api', '--method', 'DELETE', 'x')), reason);
  assert.equal(getDestructiveRefusal(ghCall('api', '--method=DELETE', 'x')), reason);
  assert.equal(getDestructiveRefusal(ghCall('api', 'x', '-X', 'delete')), reason);
  assert.equal(getDestructiveRefusal(ghCall('api', '--method=Delete', 'x')), reason);
});

test('allows gh api with another method or none', () => {
  assert.equal(getDestructiveRefusal(ghCall('api', 'repos/x/y')), undefined);
  assert.equal(getDestructiveRefusal(ghCall('api', '-X', 'GET', 'x')), undefined);
  assert.equal(getDestructiveRefusal(ghCall('api', '--method=POST', 'x')), undefined);
  assert.equal(getDestructiveRefusal(ghCall('api', 'delete')), undefined);
});

test('refuses gh alias set but allows gh alias list', () => {
  assert.equal(
    getDestructiveRefusal(ghCall('alias', 'set', 'x', 'repo delete')),
    destructiveCommands.ghAliasSet.reason,
  );
  assert.equal(getDestructiveRefusal(ghCall('alias', 'list')), undefined);
});

const OPAQUE_GH = 'cannot judge `gh` with an argument the gate cannot read';

test('refuses a gh call whose first or second word is opaque', () => {
  const opaque = { text: '$X', isOpaque: true, canSplit: true };
  const plain = { text: 'repo', isOpaque: false, canSplit: false };

  assert.equal(getDestructiveRefusal({ ...ghCall(), words: [opaque] }), OPAQUE_GH);
  assert.equal(getDestructiveRefusal({ ...ghCall(), words: [plain, opaque] }), OPAQUE_GH);
});

test('refuses an opaque later word of gh api', () => {
  assert.equal(
    getDestructiveRefusal({ ...opaqueCall('api', 'x'), tool: 'gh' }),
    'cannot judge `gh api` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('allows a quoted opaque operand of git checkout and git branch -d', () => {
  assert.equal(getDestructiveRefusal(quotedCall('checkout')), undefined);
  assert.equal(getDestructiveRefusal(quotedCall('branch', '-d')), undefined);
});

test('refuses a quoted opaque word where a leading word stands', () => {
  assert.equal(
    getDestructiveRefusal(quotedCall('stash')),
    'cannot judge `git stash` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('refuses git checkout and git restore with an absolute pathspec', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('checkout', '--', '/repo')),
    destructiveCommands.checkoutPathspec.reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('restore', '/repo/src')),
    destructiveCommands.restorePathspec.reason,
  );
});

test('refuses git update-ref --stdin', () => {
  assert.equal(
    getDestructiveRefusal(gitCall('update-ref', '--stdin')),
    destructiveCommands.updateRefStdin.reason,
  );
});

test('refuses gh api with a method the gate cannot read', () => {
  assert.equal(
    getDestructiveRefusal({ ...quotedCall('api', 'x', '-X'), tool: 'gh' }),
    destructiveCommands.ghApiDelete.reason,
  );
});

test('allows gh api with a quoted opaque path', () => {
  assert.equal(getDestructiveRefusal({ ...quotedCall('api', 'repos'), tool: 'gh' }), undefined);
});

test('refuses git remote set-head with any arguments', () => {
  const { reason } = destructiveCommands.remoteSetHead;

  assert.equal(getDestructiveRefusal(gitCall('remote', 'set-head', 'origin', 'x')), reason);
  assert.equal(getDestructiveRefusal(gitCall('remote', 'set-head', 'origin', '-a')), reason);
  assert.equal(getDestructiveRefusal(gitCall('remote', 'set-head')), reason);
});

test('allows git remote subcommands other than set-head', () => {
  assert.equal(getDestructiveRefusal(gitCall('remote', '-v')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('remote', 'add', 'origin', 'u')), undefined);
});

test('refuses git symbolic-ref with two operands, with or without -m', () => {
  const { reason } = destructiveCommands.symbolicRefWrite;

  assert.equal(
    getDestructiveRefusal(gitCall('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/heads/x')),
    reason,
  );
  assert.equal(
    getDestructiveRefusal(gitCall('symbolic-ref', '-m', 'why', 'HEAD', 'refs/heads/x')),
    reason,
  );
});

test('allows git symbolic-ref reads, deletes and a -m value alone', () => {
  assert.equal(getDestructiveRefusal(gitCall('symbolic-ref', 'HEAD')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('symbolic-ref', '--short', 'HEAD')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('symbolic-ref', '-d', 'refs/x')), undefined);
  assert.equal(getDestructiveRefusal(gitCall('symbolic-ref', '-m', 'why', 'HEAD')), undefined);
});

test('refuses an unquoted variable in git remote and git symbolic-ref', () => {
  assert.equal(
    getDestructiveRefusal(opaqueCall('remote', 'add', 'origin')),
    'cannot judge `git remote` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
  assert.equal(
    getDestructiveRefusal(opaqueCall('symbolic-ref')),
    'cannot judge `git symbolic-ref` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('allows a quoted variable in git remote add', () => {
  assert.equal(getDestructiveRefusal(quotedCall('remote', 'add', 'origin')), undefined);
});
