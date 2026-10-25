import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const IGNORING_LINES = new Set([
  'node_modules',
  'node_modules/',
  '/node_modules',
  '/node_modules/',
  '**/node_modules',
  '**/node_modules/',
]);
const ENTRY = 'node_modules/';

// The new text of root's .gitignore, or undefined when a line of it already
// ignores node_modules.
export function getGitignoreText(root: string): string | undefined {
  const path = join(root, '.gitignore');

  if (!existsSync(path)) {
    return `${ ENTRY }\n`;
  }

  const text = readFileSync(path, 'utf8');

  if (text.split('\n').some((line) => IGNORING_LINES.has(line.trim()))) {
    return undefined;
  }

  return `${ text }${ text === '' || text.endsWith('\n') ? '' : '\n' }${ ENTRY }\n`;
}
