import { dirname } from 'node:path';
import { getSessionsDirectory } from '../sessions/get-session-path.ts';

// The directory that holds the sessions and the plans, and held the prompt
// logs of the older layout. The upgrade names every path relative to it.
export function getStateDirectory(projectRoot: string): string {
  return dirname(getSessionsDirectory(projectRoot));
}
