import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CatalogViolation } from '../../../../shared/read-catalog.ts';
import { readGhCatalogs, type GhCatalogs } from './read-gh-catalogs.ts';

// Where a repository keeps the catalogs this check judges by, under its root.
export const CATALOGS_PATH = join('hooks', 'shared', 'catalogs');

// The catalogs of the repository `cwd` is in: those under the nearest directory,
// `cwd` or an ancestor, that holds CATALOGS_PATH; the first one that cannot be
// read; or undefined when no directory holds them or `cwd` is unknown, in
// which case only the rules that need no catalog apply.
export async function readRepositoryCatalogs(
  cwd: string | undefined,
): Promise<GhCatalogs | CatalogViolation | undefined> {
  const directory = cwd === undefined ? undefined : await findCatalogsDirectory(cwd);

  return directory === undefined ? undefined : readGhCatalogs(directory);
}

async function findCatalogsDirectory(directory: string): Promise<string | undefined> {
  const candidate = join(directory, CATALOGS_PATH);

  if (await isDirectory(candidate)) {
    return candidate;
  }

  const parent = dirname(directory);

  return parent === directory ? undefined : findCatalogsDirectory(parent);
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
