import { spawnSync } from 'node:child_process';
import { readGlobalHooksPath } from '../../../shared/hooks-path/read-global-hooks-path.ts';

const GIT_TIMEOUT_MS = 10000;

// Sets the global core.hooksPath and reads it back; throws when the value read differs.
export function writeGlobalHooksPath(hooksPath: string): void {
  const writeRun = spawnSync(
    'git',
    ['config', '--global', 'core.hooksPath', hooksPath],
    { encoding: 'utf8', timeout: GIT_TIMEOUT_MS },
  );

  if (writeRun.status !== 0) {
    throw new Error(`git config could not set core.hooksPath: ${ writeRun.stderr.trim() }`);
  }

  if (readGlobalHooksPath() !== hooksPath) {
    throw new Error('git config does not read back the core.hooksPath it was given');
  }
}
