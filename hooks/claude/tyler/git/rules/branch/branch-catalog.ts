import { join } from 'node:path';

// The git subcommands that create a branch, and the options whose value names
// it: short letters (attached or the next word) and long options (`=` or the
// next word, any unambiguous prefix).
export const branchCatalog = {
  creators: [
    { leading: ['checkout'], letters: 'bB', longs: ['--orphan'] },
    { leading: ['switch'], letters: 'cC', longs: ['--create', '--force-create', '--orphan'] },
    { leading: ['worktree', 'add'], letters: 'bB', longs: ['--orphan'] },
  ],
  // `git branch` options that rename or copy: the last operand is the new name.
  branchRenames: ['-m', '-M', '--move', '-c', '-C', '--copy'],
  // `git branch` options that put it in a mode other than create, list
  // included; options that only shape a listing (`--sort`) are not modes.
  branchOtherModes: [
    '-d', '-D', '--delete', '-l', '--list', '-a', '--all', '-r', '--remotes', '-v',
    '--verbose', '--show-current', '--contains', '--no-contains', '--merged', '--no-merged',
    '--points-at', '--edit-description', '-u', '--set-upstream-to', '--unset-upstream',
  ],
  // Names a new repository's first branch takes; free of the rule.
  freeNames: ['main', 'master'],
  typesPath: join(
    import.meta.dirname, '..', '..', '..', '..', '..', 'shared', 'catalogs', 'types.json',
  ),
} as const;
