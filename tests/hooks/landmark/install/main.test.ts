import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
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
