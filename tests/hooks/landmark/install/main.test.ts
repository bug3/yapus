import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { runInstall } from './run-install.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'landmark');

test('writes 13 rendered rule files and the version stamp', (t) => {
  const { home, installRun } = runInstall(t, 'install');
  const rules = join(home, '.claude', 'rules');
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(installRun.status, 0, installRun.stderr);
  assert.equal(readdirSync(rules).length, 13);
  assert.ok(!readFileSync(join(rules, 'landmark-principles.md'), 'utf8').startsWith('---'));
  assert.ok(!readFileSync(join(rules, 'landmark-git.md'), 'utf8').includes('hooks/git/'));
  assert.equal(
    readFileSync(join(home, '.claude', 'landmark', 'version'), 'utf8'),
    isRecord(manifest) ? manifest.version : undefined,
  );
  assert.match(installRun.stdout, /remove ~\/\.claude\/landmark\//);
});

test('refuses an existing stamp and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'install', { arrange: (homeDir) => {
    mkdirSync(join(homeDir, '.claude', 'landmark'), { recursive: true });
    writeFileSync(join(homeDir, '.claude', 'landmark', 'version'), '0.0.1');
  } });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /use \/landmark:upgrade/);
  assert.equal(existsSync(join(home, '.claude', 'rules')), false);
});

test('refuses an existing landmark rule file and lists every conflict', (t) => {
  const { home, installRun } = runInstall(t, 'install', { arrange: (homeDir) => {
    mkdirSync(join(homeDir, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(homeDir, '.claude', 'rules', 'landmark-git.md'), 'mine');
    writeFileSync(join(homeDir, '.claude', 'rules', 'landmark-code.md'), 'mine');
  } });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /landmark-code\.md[\s\S]*landmark-git\.md/);
  assert.deepEqual(
    readdirSync(join(home, '.claude', 'rules')).sort(),
    ['landmark-code.md', 'landmark-git.md'],
  );
  assert.equal(existsSync(join(home, '.claude', 'landmark')), false);
});

test('refuses an unknown mode and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'upgrade');

  assert.equal(installRun.status, 2);
  assert.equal(existsSync(join(home, '.claude')), false);
});

test('refuses a foreign global hooks path and writes nothing', (t) => {
  const config = '[core]\n\thooksPath = /elsewhere\n';
  const { home, installRun } = runInstall(t, 'install', { arrange: (homeDir) => {
    writeFileSync(join(homeDir, '.gitconfig'), config);
  } });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /\/elsewhere/);
  assert.equal(existsSync(join(home, '.claude')), false);
  assert.equal(readFileSync(join(home, '.gitconfig'), 'utf8'), config);
});

test('refuses a hooks path injected through the environment and writes nothing', (t) => {
  const { home, installRun } = runInstall(t, 'install', { extraEnv: {
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
