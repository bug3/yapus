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
  'hooks/git/pre-commit',
  'hooks/git/pre-push',
  'hooks/git/reference-transaction',
];

// The rules file the secret scanner reads; gitleaks takes only TOML.
const TOOL_CONFIGS: readonly string[] = ['hooks/shared/scanner/gitleaks.toml'];

// Every kept file under root in a language or format the repository does
// not use.
export function getForeignFiles(root: string): string[] {
  return listAllFiles(root).filter((path) => !isKept(path));
}

function isKept(path: string): boolean {
  return KEPT_EXTENSIONS.includes(extname(path))
    || KEPT_NAMES.includes(basename(path))
    || SHELL_ENTRIES.includes(path)
    || TOOL_CONFIGS.includes(path);
}
