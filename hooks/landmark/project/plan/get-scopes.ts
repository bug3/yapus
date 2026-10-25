import { runGit } from './run-git.ts';

const SCOPE_FORM = /^[a-z0-9-]+$/;
const FIXED_SCOPE = 'project';

// The seed of .landmark/scopes.json as canonical JSON: the first segment of
// every tracked path that has a slash, if it is of the scope form, plus
// "project", unique and sorted by <.
export function getScopes(root: string): string {
  const paths = runGit(['ls-files', '-z'], root).stdout.split('\0');
  const firsts = paths
    .filter((path) => path.includes('/'))
    .map((path) => path.slice(0, path.indexOf('/')))
    .filter((segment) => SCOPE_FORM.test(segment));
  const scopes = [...new Set([...firsts, FIXED_SCOPE])]
    .sort();

  return `${ JSON.stringify(scopes, undefined, 2) }\n`;
}
