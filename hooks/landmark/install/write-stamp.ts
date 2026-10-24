import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getStampPath } from '../../shared/hooks-path/get-stamp-path.ts';

// Writes the version stamp under home and returns its path. It is the last
// write of an install or an upgrade: a stamp at the new version claims all
// else is in place.
export function writeStamp(home: string, version: string): string {
  const stamp = getStampPath(home);

  mkdirSync(dirname(stamp), { recursive: true });
  writeFileSync(stamp, version);

  return stamp;
}
