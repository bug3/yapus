import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'landmark');
const SUBPROCESS_TIMEOUT_MS = 20000;

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
  const { home, installRun } = runInstall(t, 'install', (homeDir) => {
    mkdirSync(join(homeDir, '.claude', 'landmark'), { recursive: true });
    writeFileSync(join(homeDir, '.claude', 'landmark', 'version'), '0.0.1');
  });

  assert.equal(installRun.status, 2);
  assert.match(installRun.stderr, /use \/landmark:upgrade/);
  assert.equal(existsSync(join(home, '.claude', 'rules')), false);
});

test('refuses an existing landmark rule file and lists every conflict', (t) => {
  const { home, installRun } = runInstall(t, 'install', (homeDir) => {
    mkdirSync(join(homeDir, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(homeDir, '.claude', 'rules', 'landmark-git.md'), 'mine');
    writeFileSync(join(homeDir, '.claude', 'rules', 'landmark-code.md'), 'mine');
  });

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

function runInstall(t: TestContext, mode: string, arrange?: (home: string) => void) {
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
