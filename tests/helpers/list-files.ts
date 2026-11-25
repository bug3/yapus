import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { getCallerGitEnv } from './run-git.ts';

// eslint.config.ts is named by ESLint; main.ts is every hook's entry, named
// by hooks/run.sh, and runs on import.
const NOT_MODULES: readonly string[] = ['eslint.config.ts', 'main.ts'];
const LS_FILES_ARGS: readonly string[] = [
  'ls-files',
  '-z',
  '--cached',
  '--others',
  '--exclude-standard',
];
const SUBPROCESS_TIMEOUT_MS = 10000;

export function listModules(root: string): string[] {
  return listFiles(root, '.ts').filter(isModule);
}

export function listFiles(root: string, extension: string): string[] {
  return listAllFiles(root).filter((path) => path.endsWith(extension));
}

// The files git keeps under root, tracked or untracked but not ignored by
// the repository or the caller's excludes, that are files on disk, relative
// to root; root is in a git work tree. A link counts as what it points to, so
// a link to a directory is left out.
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
  const listing = execFileSync('git', LS_FILES_ARGS, {
    cwd: root,
    encoding: 'utf8',
    env: getCallerGitEnv(process.env),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return listing.split('\0').filter((path) => path !== '');
}
