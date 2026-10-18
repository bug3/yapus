import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';

// eslint.config.ts is named by ESLint; main.ts is every hook's entry, named
// by hooks/claude/run.sh, and runs on import.
const NOT_MODULES: readonly string[] = ['eslint.config.ts', 'main.ts'];

export function listModules(root: string): string[] {
  return listFiles(root, '.ts').filter(isModule);
}

// The files git keeps under root, tracked or untracked but not ignored,
// that are on disk, relative to root; root is in a git work tree.
export function listFiles(root: string, extension: string): string[] {
  return getKeptPaths(root)
    .filter((path) => path.endsWith(extension))
    .filter((path) => existsSync(join(root, path)));
}

function isModule(path: string): boolean {
  return !path.endsWith('.test.ts') && !NOT_MODULES.includes(basename(path));
}

function getKeptPaths(root: string): string[] {
  const listing = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8' },
  );

  return listing.split('\0').filter((path) => path !== '');
}
