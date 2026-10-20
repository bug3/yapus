import { hasFlag, type Arguments } from '../read-arguments.ts';

export type DestructiveId =
  | 'branchDelete'
  | 'checkoutPathspec'
  | 'cleanForce'
  | 'ghRepoDelete'
  | 'resetHard'
  | 'restorePathspec'
  | 'stashClear'
  | 'stashDrop';

export interface Matcher {
  readonly tool: 'git' | 'gh';
  // The words that name the command, starting at the subcommand.
  readonly leading: readonly string[];
  readonly reason: string;
  // Whether an argument the gate cannot read makes the call unjudgeable.
  readonly hasOpaqueGuard: boolean;
  // Judges the words after the leading ones.
  readonly isMatch: (args: Arguments) => boolean;
}

const WHOLE_TREE = ['.', ':/', '*'];

export const destructiveCommands = {
  resetHard: {
    tool: 'git',
    leading: ['reset'],
    reason: '`git reset --hard` discards uncommitted work; a person runs it',
    hasOpaqueGuard: true,
    isMatch: (args) => hasFlag(args, '--hard'),
  },
  cleanForce: {
    tool: 'git',
    leading: ['clean'],
    reason: '`git clean -f` deletes untracked files for good; a person runs it',
    hasOpaqueGuard: true,
    isMatch: (args) => hasFlag(args, '-f') || hasFlag(args, '--force'),
  },
  checkoutPathspec: {
    tool: 'git',
    leading: ['checkout'],
    reason: '`git checkout .` discards uncommitted work; a person runs it',
    hasOpaqueGuard: true,
    isMatch: hasWholeTree,
  },
  restorePathspec: {
    tool: 'git',
    leading: ['restore'],
    reason: '`git restore .` discards uncommitted work; a person runs it',
    hasOpaqueGuard: true,
    isMatch: (args) => hasWholeTree(args) && !restoresIndexOnly(args),
  },
  branchDelete: {
    tool: 'git',
    leading: ['branch'],
    reason: '`git branch -D` deletes a branch even if unmerged; a person runs it',
    hasOpaqueGuard: true,
    isMatch: (args) => hasFlag(args, '-D') || (hasDelete(args) && hasForce(args)),
  },
  stashDrop: {
    tool: 'git',
    leading: ['stash', 'drop'],
    reason: '`git stash drop` deletes a stash entry; a person runs it',
    hasOpaqueGuard: true,
    isMatch: () => true,
  },
  stashClear: {
    tool: 'git',
    leading: ['stash', 'clear'],
    reason: '`git stash clear` deletes every stash entry; a person runs it',
    hasOpaqueGuard: true,
    isMatch: () => true,
  },
  ghRepoDelete: {
    tool: 'gh',
    leading: ['repo', 'delete'],
    reason: '`gh repo delete` deletes a repository; a person runs it',
    hasOpaqueGuard: false,
    isMatch: () => true,
  },
} as const satisfies Record<DestructiveId, Matcher>;

function hasWholeTree(args: Arguments): boolean {
  return args.operands.some((operand) => WHOLE_TREE.includes(operand));
}

function restoresIndexOnly(args: Arguments): boolean {
  const hasStaged = hasFlag(args, '--staged') || hasFlag(args, '-S');
  const hasWorktree = hasFlag(args, '--worktree') || hasFlag(args, '-W');

  return hasStaged && !hasWorktree;
}

function hasDelete(args: Arguments): boolean {
  return hasFlag(args, '-d') || hasFlag(args, '--delete');
}

function hasForce(args: Arguments): boolean {
  return hasFlag(args, '-f') || hasFlag(args, '--force');
}
