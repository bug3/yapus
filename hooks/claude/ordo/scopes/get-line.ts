import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getExclusion } from '../../../shared/exclusion/get-exclusion.ts';
import { getProjectDirectory } from '../../../shared/hooks-path/get-project-directory.ts';
import { readCatalog } from '../../../shared/read-catalog.ts';

// The one line the main agent should see: the scopes of a valid catalog,
// the shared reader's violation for an invalid one, or undefined when the
// project has no scope catalog, no project directory is known or the project
// is on the ordo exclusion list under home.
export async function getLine(
  projectDir: string,
  home: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (projectDir === '' || getExclusion(projectDir, home, env).kind === 'excluded') {
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
