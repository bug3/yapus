import { join } from 'node:path';

// The directory of a project's plans, one directory per month and one per
// topic in it, under the directory the session was opened in and beside the
// sessions.
export function getPlansDirectory(projectRoot: string): string {
  return join(projectRoot, '.yapus', 'plans');
}
