import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

const MISSING_FILE_CODE = 'ENOENT';

export interface Exclusions {
  readonly roots: readonly string[];
}

export interface ExclusionsViolation {
  readonly violation: string;
}

// The roots the list at path holds; a missing file is an empty list, since
// ordo is on everywhere until a project is excluded.
export function readExclusions(path: string): Exclusions | ExclusionsViolation {
  let listText: string;

  try {
    listText = readFileSync(path, 'utf8');
  } catch (error) {
    return isMissingFile(error) ? { roots: [] } : makeViolation(path, 'cannot be read');
  }

  let roots: unknown;

  try {
    roots = JSON.parse(listText);
  } catch {
    return makeViolation(path, 'is not JSON');
  }

  return isRootList(roots)
    ? { roots }
    : makeViolation(path, 'is not a sorted array of distinct absolute paths');
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING_FILE_CODE;
}

function isRootList(roots: unknown): roots is string[] {
  const isRoot = (root: unknown): root is string => typeof root === 'string' && isAbsolute(root);

  return Array.isArray(roots) && roots.every(isRoot) && isSortedAndDistinct(roots);
}

function isSortedAndDistinct(roots: readonly string[]): boolean {
  return roots.every((root, index) => {
    const previous = roots[index - 1];

    return previous === undefined || previous < root;
  });
}

function makeViolation(path: string, reason: string): ExclusionsViolation {
  return { violation: `${ path } ${ reason }` };
}
