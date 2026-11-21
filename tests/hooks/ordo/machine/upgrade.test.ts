import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { readPluginVersion } from '../../../../hooks/shared/read-plugin-version.ts';
import { makeEnv, runInstall } from './run-install.ts';

const UPGRADE_TIMEOUT_MS = 20000;
const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'ordo');
const PLUGIN_VERSION = readPluginVersion(PLUGIN);
const NEXT_VERSION = '99.0.0';

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
  const { home } = runInstall(t, 'machine');
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

  return spawnSync('bash', [entry, 'ordo/machine', root, 'upgrade'], {
    encoding: 'utf8', env: makeEnv(home, extraEnv), timeout: UPGRADE_TIMEOUT_MS,
  });
}

function bumpVersion(root: string): void {
  const manifest = join(root, '.claude-plugin', 'plugin.json');

  writeFileSync(
    manifest,
    readFileSync(manifest, 'utf8').replace(`"${ PLUGIN_VERSION }"`, `"${ NEXT_VERSION }"`),
  );
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
  assert.match(upgradeRun.stdout, /yapus ordo upgrade: wrote/);
  assert.equal(snapshot(home), before);
});

test('upgrade after a plugin change rewrites the rule file and the stamp', (t) => {
  const { home, before, upgradeRun } = installThenUpgrade(t, (root) => {
    const standard = join(root, 'standards', 'GIT.md');

    writeFileSync(standard, `${ readFileSync(standard, 'utf8') }\nAdded line.\n`);
    bumpVersion(root);
  });
  const rule = readFileSync(
    join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md'),
    'utf8',
  );

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(
    readFileSync(join(home, '.claude', 'yapus', 'ordo', 'version'), 'utf8'),
    NEXT_VERSION,
  );
  assert.match(rule, /Added line\./);
  assert.notEqual(snapshot(home), before);
});

test('upgrade removes a stale rule file and keeps the current ones', (t) => {
  const { home } = runInstall(t, 'machine');
  const rulesDirectory = join(home, '.claude', 'rules', 'yapus', 'ordo');

  writeFileSync(join(rulesDirectory, 'dropped.md'), 'stale');

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(existsSync(join(rulesDirectory, 'dropped.md')), false);
  assert.equal(readdirSync(rulesDirectory).length, 15);
  assert.equal(existsSync(join(rulesDirectory, 'git.md')), true);
});

test('upgrade keeps a file of the rules directory that is not markdown', (t) => {
  const { home } = runInstall(t, 'machine');
  const rulesDirectory = join(home, '.claude', 'rules', 'yapus', 'ordo');

  writeFileSync(join(rulesDirectory, 'notes.txt'), 'mine');
  writeFileSync(join(rulesDirectory, 'dropped.md'), 'stale');

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(readFileSync(join(rulesDirectory, 'notes.txt'), 'utf8'), 'mine');
  assert.equal(existsSync(join(rulesDirectory, 'dropped.md')), false);
});

test('upgrade keeps a directory named like a rule file and still succeeds', (t) => {
  const { home } = runInstall(t, 'machine');
  const folder = join(home, '.claude', 'rules', 'yapus', 'ordo', 'x.md');

  mkdirSync(folder);
  writeFileSync(join(folder, 'inner'), 'mine');

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(readFileSync(join(folder, 'inner'), 'utf8'), 'mine');
});

test('upgrade after a change to a hook file rewrites that installed hook file', (t) => {
  const hook = join('shared', 'read-catalog.ts');
  const { home, upgradeRun } = installThenUpgrade(t, (root) => {
    const source = join(root, 'runtime', hook);

    writeFileSync(source, `${ readFileSync(source, 'utf8') }\n// Changed.\n`);
  });

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.match(
    readFileSync(join(home, '.claude', 'yapus', 'ordo', 'hooks', hook), 'utf8'),
    /\/\/ Changed\.\n$/,
  );
});

test('upgrade removes the hooks.new and hooks.old a killed run left', (t) => {
  const { home } = runInstall(t, 'machine');
  const ordo = join(home, '.claude', 'yapus', 'ordo');
  const leftovers = [join(ordo, 'hooks.new'), join(ordo, 'hooks.old')];

  leftovers.forEach((leftover) => {
    mkdirSync(leftover);
    writeFileSync(join(leftover, 'stale'), 'x');
  });

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.deepEqual(leftovers.map((leftover) => existsSync(leftover)), [false, false]);
});

test('upgrade that fails in the hooks copy keeps the old hooks and the old stamp', (t) => {
  const { home, before, upgradeRun } = installThenUpgrade(t, (root) => {
    bumpVersion(root);
    rmSync(join(root, 'runtime', 'shared', 'read-catalog.ts'));
  });
  const checkRun = spawnSync(
    'bash',
    [join(getRoot(home), 'runtime', 'run.sh'), 'claude/ordo/check', getRoot(home)],
    { encoding: 'utf8', env: makeEnv(home), timeout: UPGRADE_TIMEOUT_MS },
  );

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /crashed/);
  assert.equal(snapshot(home), before);
  assert.equal(
    readFileSync(join(home, '.claude', 'yapus', 'ordo', 'version'), 'utf8'),
    PLUGIN_VERSION,
  );
  assert.match(checkRun.stdout, /run \/ordo:upgrade/);
});

test('upgrade without a stamp is refused and writes nothing', (t) => {
  const { home } = runInstall(t, 'machine');

  rmSync(join(home, '.claude', 'yapus', 'ordo', 'version'));
  rmSync(join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md'));

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /is absent; the person can run \/ordo:machine or ask for it/);
  assert.equal(existsSync(join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md')), false);
  assert.equal(existsSync(join(home, '.claude', 'yapus', 'ordo', 'version')), false);
});

test('upgrade sets the global hooks path when it is unset', (t) => {
  const { home } = runInstall(t, 'machine');

  gitConfig(home, ['--unset', 'core.hooksPath']);

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 0, upgradeRun.stderr);
  assert.equal(
    gitConfig(home, ['--get', 'core.hooksPath']),
    join(home, '.claude', 'yapus', 'ordo', 'hooks', 'git'),
  );
});

test('upgrade refuses a foreign global hooks path and writes nothing', (t) => {
  const { home } = runInstall(t, 'machine');

  gitConfig(home, ['core.hooksPath', '/elsewhere']);
  rmSync(join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md'));

  const upgradeRun = runUpgrade(home);

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /\/elsewhere/);
  assert.equal(existsSync(join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md')), false);
});

test('upgrade refuses a hooks path injected through the environment', (t) => {
  const { home } = runInstall(t, 'machine');

  rmSync(join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md'));

  const upgradeRun = runUpgrade(home, {
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: '/old',
  });

  assert.equal(upgradeRun.status, 2);
  assert.match(upgradeRun.stderr, /retire it first/);
  assert.equal(existsSync(join(home, '.claude', 'rules', 'yapus', 'ordo', 'git.md')), false);
});
