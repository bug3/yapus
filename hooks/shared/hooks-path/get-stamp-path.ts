import { join } from 'node:path';

// The version stamp install writes last, as an absolute path under home.
export function getStampPath(home: string): string {
  return join(home, '.claude', 'landmark', 'version');
}
