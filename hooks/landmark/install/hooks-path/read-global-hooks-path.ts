import { spawnSync } from 'node:child_process';

const GIT_TIMEOUT_MS = 10000;
const READ_ARGS = ['config', '--global', '--type=path', '--get', 'core.hooksPath'];
const UNSET_STATUS = 1;

// The global core.hooksPath in the form git expands, or undefined when unset;
// throws when git fails any other way.
export function readGlobalHooksPath(): string | undefined {
  const readRun = spawnSync('git', READ_ARGS, { encoding: 'utf8', timeout: GIT_TIMEOUT_MS });

  if (readRun.status === UNSET_STATUS) {
    return undefined;
  }

  if (readRun.status !== 0) {
    throw new Error(`git config could not read core.hooksPath: ${ readRun.stderr.trim() }`);
  }

  return readRun.stdout.trimEnd();
}
