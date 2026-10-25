import { join } from 'node:path';

// The directory install writes the rule files into, as an absolute path under home.
export function getRulesDirectory(home: string): string {
  return join(home, '.claude', 'rules', 'yapus', 'landmark');
}
