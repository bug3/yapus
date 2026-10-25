import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDirectory } from '../../../shared/hooks-path/get-project-directory.ts';
import { readCatalog } from '../../../shared/read-catalog.ts';

// The one line the session should see, or undefined when the project has no
// scope catalog or no project directory is known.
export async function getLine(projectDir: string): Promise<string | undefined> {
  if (projectDir === '') {
    return undefined;
  }

  const directory = getProjectDirectory();
  const path = join(projectDir, directory, 'scopes.json');

  if (!existsSync(path)) {
    return undefined;
  }

  const catalog = await readCatalog(path, 'scope');

  if ('violation' in catalog) {
    return catalog.violation;
  }

  return `Commit scopes of this repository (${ directory }/scopes.json): `
    + `${ catalog.words.join(', ') };`
    + ' a new scope enters that file in the commit that first uses it.';
}
