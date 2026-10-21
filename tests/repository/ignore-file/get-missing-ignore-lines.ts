import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG = join('hooks', 'shared', 'catalogs', 'never-commit.json');

// Every line of the never-commit catalog under root that its .gitignore lacks.
export function getMissingIgnoreLines(root: string): string[] {
  const patterns: unknown = JSON.parse(readFileSync(join(root, CATALOG), 'utf8'));
  const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');

  if (!Array.isArray(patterns) || !patterns.every((pattern) => typeof pattern === 'string')) {
    throw new TypeError(`${ CATALOG } is not an array of strings`);
  }

  return patterns.filter((pattern) => !lines.includes(pattern));
}
