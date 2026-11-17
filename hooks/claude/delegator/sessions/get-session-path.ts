import { join } from 'node:path';

// The directory of a project's session files, one directory per month, under
// the directory the session was opened in and apart from the plans beside it.
export function getSessionsDirectory(projectRoot: string): string {
  return join(projectRoot, '.yapus', 'sessions');
}

// The file of the session whose first logged prompt came at the ISO time:
// <YYYY-MM>/<DD>T<HH-MM-SS>Z_<id>.jsonl in UTC, one JSON line per typed
// prompt. A listing sorts by time, and '_' is in neither the stamp nor the id.
export function getSessionPath(projectRoot: string, sessionId: string, time: string): string {
  const month = time.slice(0, 7);
  const stamp = `${ time.slice(8, 19).replaceAll(':', '-') }Z`;

  return join(getSessionsDirectory(projectRoot), month, `${ stamp }_${ sessionId }.jsonl`);
}
