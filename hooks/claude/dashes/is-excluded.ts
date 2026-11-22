import { getExclusion } from '../../shared/exclusion/get-exclusion.ts';

// Whether the dashes check is off for the session's project: only a project
// on a valid ordo exclusion list is; an invalid list leaves the check on.
export function isExcluded(projectDir: string, home: string, env: NodeJS.ProcessEnv): boolean {
  return getExclusion(projectDir, home, env).kind === 'excluded';
}
