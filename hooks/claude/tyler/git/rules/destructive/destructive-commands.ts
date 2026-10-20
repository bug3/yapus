import { hasFlag, type Arguments } from '../read-arguments.ts';

export type DestructiveId =
  | 'branchDelete'
  | 'checkoutForce'
  | 'checkoutPathspec'
  | 'cleanForce'
  | 'ghAliasSet'
  | 'ghApiDelete'
  | 'ghRepoDelete'
  | 'resetHard'
  | 'restorePathspec'
  | 'stashClear'
  | 'stashDrop'
  | 'switchForce'
  | 'updateRefDelete';

// The arguments after the leading words, with the words as written.
export interface Judged extends Arguments {
  readonly written: readonly string[];
}

export interface Matcher {
  readonly tool: 'git' | 'gh';
  // The words that name the command, starting at the subcommand.
  readonly leading: readonly string[];
  readonly reason: string;
  // Whether an argument the gate cannot read makes the call unjudgeable.
  readonly hasOpaqueGuard: boolean;
  // Judges the words after the leading ones.
  readonly isMatch: (args: Judged) => boolean;
}

const WHOLE_TREE = ['.', '', '*'];
const RESTORE_INDEX_OPTIONS = ['--staged', '-S', '-q', '--quiet'];
const FORCE_OPTIONS = ['-f', '--force', '--discard-changes'];

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
  checkoutForce: {
    tool: 'git',
    leading: ['checkout'],
    reason: '`git checkout --force` discards uncommitted work; a person runs it',
    hasOpaqueGuard: true,
    isMatch: hasForceOption,
  },
  switchForce: {
    tool: 'git',
    leading: ['switch'],
    reason: '`git switch --force` discards uncommitted work; a person runs it',
    hasOpaqueGuard: true,
    isMatch: hasForceOption,
  },
  updateRefDelete: {
    tool: 'git',
    leading: ['update-ref'],
    reason: '`git update-ref -d` deletes a ref; a person runs it',
    hasOpaqueGuard: true,
    isMatch: (args) => hasFlag(args, '-d') || hasFlag(args, '--delete'),
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
    hasOpaqueGuard: true,
    isMatch: () => true,
  },
  ghApiDelete: {
    tool: 'gh',
    leading: ['api'],
    reason: '`gh api -X DELETE` deletes on GitHub; a person runs it',
    hasOpaqueGuard: true,
    isMatch: (args) => readsDeleteMethod(args.written),
  },
  ghAliasSet: {
    tool: 'gh',
    leading: ['alias', 'set'],
    reason: '`gh alias set` can name a destructive command; a person runs it',
    hasOpaqueGuard: true,
    isMatch: () => true,
  },
} as const satisfies Record<DestructiveId, Matcher>;

function hasWholeTree(args: Arguments): boolean {
  return args.operands.some(isWholeTree) || hasFlag(args, '--pathspec-from-file');
}

// A pathspec that names the whole tree, however it is spelled.
function isWholeTree(operand: string): boolean {
  let path = operand;

  while (path.startsWith('./')) {
    path = path.slice(2);
  }

  path = path.replace(/\/+$/u, '');

  return WHOLE_TREE.includes(path)
    || operand.startsWith(':')
    || path.split('/').includes('..');
}

// Only a restore of the index alone, with no other option, keeps the work tree.
function restoresIndexOnly(args: Arguments): boolean {
  const hasStaged = hasFlag(args, '--staged') || hasFlag(args, '-S');

  return hasStaged && [...args.flags].every((flag) => RESTORE_INDEX_OPTIONS.includes(flag));
}

function hasForceOption(args: Arguments): boolean {
  return FORCE_OPTIONS.some((flag) => hasFlag(args, flag));
}

// `-X DELETE`, `-XDELETE`, `--method DELETE` or `--method=DELETE`, in any case.
function readsDeleteMethod(written: readonly string[]): boolean {
  return written.some((text, index) => {
    const method = readMethod(text, written[index + 1]);

    return method?.toLowerCase() === 'delete';
  });
}

function readMethod(text: string, next: string | undefined): string | undefined {
  if (text === '--method') {
    return next;
  }

  if (text.startsWith('--method=')) {
    return text.slice('--method='.length);
  }

  const letter = text.startsWith('-') && !text.startsWith('--') ? text.indexOf('X') : -1;

  if (letter < 0) {
    return undefined;
  }

  return letter === text.length - 1 ? next : text.slice(letter + 1);
}

function hasDelete(args: Arguments): boolean {
  return hasFlag(args, '-d') || hasFlag(args, '--delete');
}

function hasForce(args: Arguments): boolean {
  return hasFlag(args, '-f') || hasFlag(args, '--force');
}
