import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { makeEnv, runInstall } from './run-install.ts';

const UPGRADE_TIMEOUT_MS = 20000;

interface Upgraded {
  readonly home: string;
  readonly before: string;
  readonly upgradeRun: SpawnSyncReturns<string>;
}

// Installs, then upgrades from the same plugin copy; change may edit the copy first.
function installThenUpgrade(
  t: TestContext,
  change: (root: string) => void = () => undefined,
  extraEnv: NodeJS.ProcessEnv = {},
): Upgraded {
  const { home } = runInstall(t, 'install');
  const before = snapshot(home);

  change(getRoot(home));

  return { home, before, upgradeRun: runUpgrade(home, extraEnv) };
}

function getRoot(home: string): string {
  return join(home, '..', 'plugin');
}

function runUpgrade(home: string, extraEnv: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
  const root = getRoot(home);

  const entry = join(root, 'runtime', 'run.sh');

  return spawnSync('bash', [entry, 'landmark/install', root, 'upgrade'], {
    encoding: 'utf8', env: makeEnv(home, extraEnv), timeout: UPGRADE_TIMEOUT_MS,
  });
}

function gitConfig(home: string, args: string[]): string {
  return spawnSync('git', ['config', '--global', ...args], {
    encoding: 'utf8', env: makeEnv(home),
  }).stdout.trim();
}

// Every file under dir with its content, as one string.
function snapshot(dir: string): string {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
    .map((path) => `${ path }\n${ readFileSync(path, 'utf8') }`)
    .join('\n--\n');
}

test('upgrade on an unchanged plugin leaves every installed file byte-identical', (t) => {
  const { home, before, upgradeRun } = installThenUpgrade(t);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.match(upgradeRun.stdout, /yapus landmark upgrade: wrote/);
  assert.equal(snapshot(home), before);
});

test('upgrade after a plugin change rewrites the rule file and the stamp', (t) => {
  const { home, before, upgradeRun } = installThenUpgrade(t, (root) => {
    const standard = join(root, 'standards', 'GIT.md');
    const manifest = join(root, '.claude-plugin', 'plugin.json');

    writeFileSync(standard, `${ readFileSync(standard, 'utf8') }\nAdded line.\n`);
    writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('"0.1.0"', '"0.2.0"'));
  });
  const rule = readFileSync(join(home, '.claude', 'rules', 'landmark-git.md'), 'utf8');

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(readFileSync(join(home, '.claude', 'landmark', 'version'), 'utf8'), '0.2.0');
  assert.match(rule, /Added line\./);
  assert.notEqual(snapshot(home), before);
});

test('upgrade without a stamp is refused and writes nothing', (t) => {
  const { home } = runInstall(t, 'install');

  rmSync(join(home, '.claude', 'landmark', 'version'));
  rmSync(join(home, '.claude', 'rules', 'landmark-git.md'));

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /use \/landmark:install/);
  assert.equal(existsSync(join(home, '.claude', 'rules', 'landmark-git.md')), false);
  assert.equal(existsSync(join(home, '.claude', 'landmark', 'version')), false);
});

test('upgrade sets the global hooks path when it is unset', (t) => {
  const { home } = runInstall(t, 'install');

  gitConfig(home, ['--unset', 'core.hooksPath']);

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(
    gitConfig(home, ['--get', 'core.hooksPath']),
    join(home, '.claude', 'landmark', 'hooks', 'git'),
  );
});

test('upgrade refuses a foreign global hooks path and writes nothing', (t) => {
  const { home } = runInstall(t, 'install');

  gitConfig(home, ['core.hooksPath', '/elsewhere']);
  rmSync(join(home, '.claude', 'rules', 'landmark-git.md'));

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /\/elsewhere/);
  assert.equal(existsSync(join(home, '.claude', 'rules', 'landmark-git.md')), false);
});

test('upgrade refuses a hooks path injected through the environment', (t) => {
  const { home } = runInstall(t, 'install');

  rmSync(join(home, '.claude', 'rules', 'landmark-git.md'));

  const upgradeRun = runUpgrade(home, {
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: '/old',
  });

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /retire it first/);
  assert.equal(existsSync(join(home, '.claude', 'rules', 'landmark-git.md')), false);
});
