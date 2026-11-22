import { join } from 'node:path';

// The list of project roots ordo is off in, as an absolute path under home.
export function getExclusionPath(home: string): string {
  return join(home, '.claude', 'yapus', 'ordo', 'excluded.json');
}
