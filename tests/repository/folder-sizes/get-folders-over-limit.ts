import { dirname } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';

// Every folder under root that holds more than limit files, as
// folder: count, sorted, the root as '.'. Subfolders do not count as
// files. A folder whose path relative to root is in collections is
// skipped; its subfolders are not. The listing skips .git and node_modules.
export function getFoldersOverLimit(
  root: string,
  limit: number,
  collections: readonly string[],
): string[] {
  const pathsByFolder = Map.groupBy(listFiles(root, ''), (path) => dirname(path));

  return [...pathsByFolder]
    .filter(([folder]) => !collections.includes(folder))
    .filter(([, paths]) => paths.length > limit)
    .map(([folder, paths]) => `${ folder }: ${ String(paths.length) } files`)
    .sort();
}
