import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'landmark');
const SUBPROCESS_TIMEOUT_MS = 20000;

export function runInstall(
  t: TestContext,
  mode: string,
  arrange?: (home: string) => void,
): { readonly home: string; readonly installRun: SpawnSyncReturns<string> } {
  const temp = makeTempDir(t);
  const root = join(temp, 'plugin');
  const home = join(temp, 'home');

  cpSync(PLUGIN, root, { recursive: true, dereference: true });
  mkdirSync(home);
  arrange?.(home);

  const installRun = spawnSync(
    'bash',
    [join(root, 'runtime', 'run.sh'), 'landmark/install', root, mode],
    { encoding: 'utf8', env: { ...process.env, HOME: home }, timeout: SUBPROCESS_TIMEOUT_MS },
  );

  return { home, installRun };
}
