import { runGit } from './run-git.ts';

const SCOPE_FORM = /^[a-z0-9-]+$/;
const FIXED_SCOPE = 'project';

// The seed of .landmark/scopes.json as canonical JSON: the first segment of
// every tracked path that has a slash, if it is of the scope form, plus
// "project", unique and sorted by <. A failed git read throws: seeded from
// nothing, the catalog would hold only "project".
export function getScopes(root: string, env: NodeJS.ProcessEnv): string {
  const files = runGit(['ls-files', '-z'], root, env);

  if (files.status !== 0) {
    throw new Error(`git ls-files exited ${ String(files.status) }`);
  }

  const paths = files.stdout.split('\0');
  const firsts = paths
    .filter((path) => path.includes('/'))
    .map((path) => path.slice(0, path.indexOf('/')))
    .filter((segment) => SCOPE_FORM.test(segment));
  const scopes = [...new Set([...firsts, FIXED_SCOPE])]
    .sort();

  return `${ JSON.stringify(scopes, undefined, 2) }\n`;
}
