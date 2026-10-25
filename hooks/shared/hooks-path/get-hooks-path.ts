import { join } from 'node:path';

// The global core.hooksPath install sets, as an absolute path under home.
export function getHooksPath(home: string): string {
  return join(home, '.claude', 'yapus', 'landmark', 'hooks', 'git');
}
