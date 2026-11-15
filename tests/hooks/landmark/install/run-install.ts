import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

interface InstallOptions {
  readonly arrange?: (home: string) => void;
  readonly arrangePlugin?: (root: string) => void;
  readonly extraEnv?: NodeJS.ProcessEnv;
}

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'ordo');
const SUBPROCESS_TIMEOUT_MS = 20000;

// Runs the landmark install in mode from a copy of the plugin with its links
// followed, as an installed plugin is, and a temporary HOME that arrange may
// fill first and arrangePlugin may change the plugin copy. The environment has
// no GIT_* variable of the caller, the global git config is the file
// .gitconfig in the home, and extraEnv comes last.
// Returns the plugin copy, the home and the run.
export function runInstall(
  t: TestContext,
  mode: string,
  { arrange, arrangePlugin, extraEnv = {} }: InstallOptions = {},
): {
  readonly root: string;
  readonly home: string;
  readonly installRun: SpawnSyncReturns<string>;
} {
  const temp = makeTempDir(t);
  const root = join(temp, 'plugin');
  const home = join(temp, 'home');

  copyPlugin(root);
  mkdirSync(home);
  arrange?.(home);
  arrangePlugin?.(root);

  return { root, home, installRun: spawnInstall({ root, home, mode, extraEnv }) };
}

// The install of the plugin copy at root into home, in mode.
export function spawnInstall(
  { root, home, mode, extraEnv = {} }: {
    readonly root: string;
    readonly home: string;
    readonly mode: string;
    readonly extraEnv?: NodeJS.ProcessEnv;
  },
): SpawnSyncReturns<string> {
  return spawnSync(
    'bash',
    [join(root, 'runtime', 'run.sh'), 'landmark/install', root, mode],
    {
      encoding: 'utf8',
      env: makeEnv(home, extraEnv),
      timeout: SUBPROCESS_TIMEOUT_MS,
    },
  );
}

// cp -RL resolves every link, as the plugin cache does; the copy must hold none,
// or a test could write through a link into the repository.
function copyPlugin(root: string): void {
  const copyRun = spawnSync('cp', ['-RL', PLUGIN, root], { encoding: 'utf8' });

  assert.equal(copyRun.status, 0, copyRun.stderr);
  assert.deepEqual(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isSymbolicLink())
      .map((entry) => join(entry.parentPath, entry.name)),
    [],
  );
}

export function makeEnv(home: string, extraEnv: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...getGitEnv(process.env),
    HOME: home,
    GIT_CONFIG_GLOBAL: join(home, '.gitconfig'),
    ...extraEnv,
  };
}
