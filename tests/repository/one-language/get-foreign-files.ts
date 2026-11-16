import { basename, extname } from 'node:path';
import { listAllFiles } from '../../helpers/list-files.ts';

// The repository's language, the formats its docs, data and tools use, and
// its license.
const KEPT_EXTENSIONS: readonly string[] = ['.ts', '.md', '.json'];
const KEPT_NAMES: readonly string[] = ['.gitignore', 'LICENSE'];
// Bash only where a hook needs an entry that finds Node.
const SHELL_ENTRIES: readonly string[] = [
  'hooks/run.sh',
  'hooks/git/commit-msg',
  'hooks/git/forward',
  'hooks/git/reference-transaction',
];
// YAML only where GitHub reads it (DATA-1).
const YAML_DIRECTORY = '.github/';
// SVG only where VitePress serves static files.
const SVG_DIRECTORY = 'docs/public/';

// Every kept file under root in a language or format the repository does
// not use.
export function getForeignFiles(root: string): string[] {
  return listAllFiles(root).filter((path) => !isKept(path));
}

function isKept(path: string): boolean {
  return KEPT_EXTENSIONS.includes(extname(path))
    || KEPT_NAMES.includes(basename(path))
    || SHELL_ENTRIES.includes(path)
    || isGitHubYaml(path)
    || isSiteSvg(path);
}

function isGitHubYaml(path: string): boolean {
  return extname(path) === '.yml' && path.startsWith(YAML_DIRECTORY);
}

function isSiteSvg(path: string): boolean {
  return extname(path) === '.svg' && path.startsWith(SVG_DIRECTORY);
}
