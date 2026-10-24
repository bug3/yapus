import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

interface InstallOptions {
  readonly arrange?: (home: string) => void;
  readonly extraEnv?: NodeJS.ProcessEnv;
}

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'landmark');
const SUBPROCESS_TIMEOUT_MS = 20000;

// Runs the landmark install in mode from a copy of the plugin with its links
// followed, as an installed plugin is, and a temporary HOME that arrange may
// fill first. The environment has no GIT_* variable of the caller, the global
// git config is the file .gitconfig in the home, and extraEnv comes last.
// Returns the home and the run.
export function runInstall(
  t: TestContext,
  mode: string,
  { arrange, extraEnv = {} }: InstallOptions = {},
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
    {
      encoding: 'utf8',
      env: makeEnv(home, extraEnv),
      timeout: SUBPROCESS_TIMEOUT_MS,
    },
  );

  return { home, installRun };
}

export function makeEnv(home: string, extraEnv: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...getGitEnv(process.env),
    HOME: home,
    GIT_CONFIG_GLOBAL: join(home, '.gitconfig'),
    ...extraEnv,
  };
}
