import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readNameList } from '../../../../hooks/ordo/machine/read-name-list.ts';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { makeEnv, runInstall, spawnInstall } from './run-install.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'ordo');

test('writes 17 rendered rule files and the version stamp', (t) => {
  const { home, installRun } = runInstall(t, 'machine');
  const rules = join(home, '.claude', 'rules', 'yapus', 'ordo');
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(installRun.status, 0, installRun.stderr);
  assert.equal(readdirSync(rules).length, 17);
  assert.ok(!readFileSync(join(rules, 'principles.md'), 'utf8').startsWith('---'));
  const gitRule = readFileSync(join(rules, 'git.md'), 'utf8');

  assert.ok(!gitRule.includes('hooks/shared/'));
  assert.ok(gitRule.includes('.claude/yapus/ordo/scopes.json'));
  assert.equal(
    readFileSync(join(home, '.claude', 'yapus', 'ordo', 'version'), 'utf8'),
    isRecord(manifest) ? manifest.version : undefined,
  );
  assert.match(installRun.stdout, /remove ~\/\.claude\/yapus\/ordo\//);
  assert.ok(installRun.stdout.includes('  remove ~/.claude/rules/yapus/ordo/\n'));
});

test('refuses an existing stamp and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'machine', { arrange: (homeDir) => {
    mkdirSync(join(homeDir, '.claude', 'yapus', 'ordo'), { recursive: true });
    writeFileSync(join(homeDir, '.claude', 'yapus', 'ordo', 'version'), '0.0.1');
  } });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /exists; the person can run \/ordo:upgrade or ask for it/);
  assert.equal(existsSync(join(home, '.claude', 'rules')), false);
  assert.equal(existsSync(join(home, '.gitconfig')), false);
});

test('refuses an existing rules directory and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'machine', { arrange: (homeDir) => {
    mkdirSync(join(homeDir, '.claude', 'rules', 'yapus', 'ordo'), { recursive: true });
  } });
  const rulesDirectory = join(home, '.claude', 'rules', 'yapus', 'ordo');

  assert.equal(installRun.status, 2);
  assert.ok(installRun.stderr.includes(`\n${ rulesDirectory } exists; remove it first\n`));
  assert.deepEqual(readdirSync(rulesDirectory), []);
  assert.equal(existsSync(join(home, '.claude', 'yapus', 'ordo')), false);
  assert.equal(existsSync(join(home, '.gitconfig')), false);
});

test('refuses an unknown mode and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'repair');

  assert.equal(installRun.status, 2);
  assert.equal(existsSync(join(home, '.claude')), false);
});

test('sets the global hooks path to the installed directory and prints its undo', (t) => {
  const { home, installRun } = runInstall(t, 'machine');
  const hooksPath = spawnSync('git', ['config', '--global', '--get', 'core.hooksPath'], {
    encoding: 'utf8', env: makeEnv(home),
  });

  assert.equal(
    hooksPath.stdout.trim(),
    join(home, '.claude', 'yapus', 'ordo', 'hooks', 'git'),
  );
  assert.match(installRun.stdout, /git config --global --unset core\.hooksPath/);
});

test('refuses a foreign global hooks path and writes nothing', (t) => {
  const config = '[core]\n\thooksPath = /elsewhere\n';
  const { home, installRun } = runInstall(t, 'machine', { arrange: (homeDir) => {
    writeFileSync(join(homeDir, '.gitconfig'), config);
  } });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /\/elsewhere/);
  assert.equal(existsSync(join(home, '.claude')), false);
  assert.equal(readFileSync(join(home, '.gitconfig'), 'utf8'), config);
});

test('refuses a hooks path injected through the environment and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'machine', { extraEnv: {
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'user.name',
    GIT_CONFIG_VALUE_0: 'x',
    GIT_CONFIG_KEY_1: 'core.hooksPath',
    GIT_CONFIG_VALUE_1: '/old',
  } });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /retire it first/);
  assert.equal(existsSync(join(home, '.claude')), false);
  assert.equal(existsSync(join(home, '.gitconfig')), false);
});

test('leaves no rule, stamp or git config when hooks fail, and a re-run installs', (t) => {
  const listed = readNameList(
    join(PLUGIN, 'runtime', 'ordo', 'machine', 'hook-files.json'),
  )[0] ?? '';
  const { root, home, installRun } = runInstall(t, 'machine', { arrangePlugin: (pluginRoot) => {
    rmSync(join(pluginRoot, 'runtime', listed));
  } });

  assert.equal(installRun.status, 2);
  assert.equal(existsSync(join(home, '.claude', 'rules')), false);
  assert.equal(existsSync(join(home, '.claude', 'yapus', 'ordo', 'version')), false);
  assert.equal(existsSync(join(home, '.gitconfig')), false);

  copyFileSync(join(PLUGIN, 'runtime', listed), join(root, 'runtime', listed));

  const rerun = spawnInstall({ root, home, mode: 'machine' });

  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(readdirSync(join(home, '.claude', 'rules', 'yapus', 'ordo')).length, 17);
});
