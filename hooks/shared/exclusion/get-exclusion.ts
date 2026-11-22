import { statSync } from 'node:fs';
import { getExclusionPath } from './get-exclusion-path.ts';
import { getMainRoot } from './get-main-root.ts';
import { readExclusions } from './read-exclusions.ts';

export type Exclusion =
  | { readonly kind: 'excluded'; readonly root: string }
  | { readonly kind: 'included' }
  | { readonly kind: 'invalid'; readonly violation: string };

// Whether ordo is off for directory by the list under home. An empty list and
// a directory that is not an existing one are settled before any git call, so
// a project off the list runs as it did before the list existed.
export function getExclusion(directory: string, home: string, env: NodeJS.ProcessEnv): Exclusion {
  const exclusions = readExclusions(getExclusionPath(home));

  if ('violation' in exclusions) {
    return { kind: 'invalid', violation: exclusions.violation };
  }

  if (exclusions.roots.length === 0 || !isDirectory(directory)) {
    return { kind: 'included' };
  }

  const root = getMainRoot(directory, env);

  return exclusions.roots.includes(root) ? { kind: 'excluded', root } : { kind: 'included' };
}

// An empty directory name fails statSync too.
function isDirectory(directory: string): boolean {
  try {
    return statSync(directory).isDirectory();
  } catch {
    return false;
  }
}
