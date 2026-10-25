import { existsSync } from 'node:fs';
import { join } from 'node:path';

// The scope catalog next to the code (yapus), else the repository's own, else
// none: an installed copy of the hooks ships without scopes.json, and a
// repository that lists none accepts any scope of the word form.
export function findScopesPath(
  catalogsDirectory: string,
  repositoryRoot: string,
): string | undefined {
  return [
    join(catalogsDirectory, 'scopes.json'),
    join(repositoryRoot, '.claude', 'yapus', 'landmark', 'scopes.json'),
  ].find((path) => existsSync(path));
}
