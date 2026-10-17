import { readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const SKIPPED_DIRECTORIES: readonly string[] = ['.git', 'node_modules'];

// eslint.config.ts is named by ESLint; main.ts is every hook's entry, named
// by hooks/run.sh, and runs on import.
const NOT_MODULES: readonly string[] = ['eslint.config.ts', 'main.ts'];

export function listModules(root: string): string[] {
  return listFiles(root, '.ts').filter(isModule);
}

export function listFiles(root: string, extension: string): string[] {
  return getFilePaths(root)
    .map((path) => relative(root, path))
    .filter((path) => path.endsWith(extension));
}

function isModule(path: string): boolean {
  return !path.endsWith('.test.ts') && !NOT_MODULES.includes(basename(path));
}

function getFilePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.includes(entry.name) ? [] : getFilePaths(path);
    }

    return [path];
  });
}
