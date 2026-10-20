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
    words: texts.map((text) => ({ text, isOpaque: false })),
    configs: [],
    assignments: [],
  };
}

function opaqueCall(...texts: readonly string[]): Call {
  const call = gitCall(...texts);

  return { ...call, words: [...call.words, { text: '$X', isOpaque: true }] };
}

function ghCall(...texts: readonly string[]): Call {
  return { ...gitCall(...texts), tool: 'gh' };
}

const OPAQUE_RESET = 'cannot judge `git reset` with an argument the gate cannot read';

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
    'cannot judge `git stash` with an argument the gate cannot read',
  );
});

test('refuses an opaque argument of git branch', () => {
  assert.equal(
    getDestructiveRefusal(opaqueCall('branch', '-d')),
    'cannot judge `git branch` with an argument the gate cannot read',
  );
});

test('allows an opaque argument of git log', () => {
  assert.equal(getDestructiveRefusal(opaqueCall('log')), undefined);
});

test('allows an opaque argument of gh repo view', () => {
  assert.equal(getDestructiveRefusal({ ...opaqueCall('repo', 'view'), tool: 'gh' }), undefined);
});
