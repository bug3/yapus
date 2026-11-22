import {
  chmodSync, existsSync, mkdirSync, realpathSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const STAGING_SUFFIX = '.new';
const PERMISSION_BITS = 0o7777;
const EXCLUSIVE_CREATE_FLAG = 'wx';

// Writes text to path, creating its directory, through a file beside it that
// is renamed over path, so a reader sees the old file or the new one, never a
// half-written one. The process id keeps two writers' staging files apart,
// so one cannot rename the other's half-written file into place. An existing
// file keeps its mode, and a link keeps pointing where it did, since the
// rename lands on the link's target. The staging file is created
// exclusively, so a link planted at its name, which a repository can commit,
// is never followed: an existing staging path throws. Returns path.
export function writeFile(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });

  const isExisting = existsSync(path);
  const target = isExisting ? realpathSync(path) : path;
  const staging = `${ target }.${ String(process.pid) }${ STAGING_SUFFIX }`;

  writeFileSync(staging, text, { flag: EXCLUSIVE_CREATE_FLAG });

  if (isExisting) {
    chmodSync(staging, statSync(target).mode & PERMISSION_BITS);
  }

  renameSync(staging, target);

  return path;
}
