import { statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runGit } from './run-git.ts';

// eslint.config.ts is named by ESLint; main.ts is every hook's entry, named
// by hooks/run.sh, and runs on import.
const NOT_MODULES: readonly string[] = ['eslint.config.ts', 'main.ts'];

export function listModules(root: string): string[] {
  return listFiles(root, '.ts').filter(isModule);
}

export function listFiles(root: string, extension: string): string[] {
  return listAllFiles(root).filter((path) => path.endsWith(extension));
}

// The files git keeps under root, tracked or untracked but not ignored,
// that are files on disk, relative to root; root is in a git work tree. A
// link counts as what it points to, so a link to a directory is left out.
export function listAllFiles(root: string): string[] {
  return getKeptPaths(root).filter((path) => isFileOnDisk(join(root, path)));
}

function isFileOnDisk(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() === true;
}

function isModule(path: string): boolean {
  return !path.endsWith('.test.ts') && !NOT_MODULES.includes(basename(path));
}

function getKeptPaths(root: string): string[] {
  const listing = runGit(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root);

  return listing.split('\0').filter((path) => path !== '');
}
