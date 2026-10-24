import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'landmark');
const SUBPROCESS_TIMEOUT_MS = 20000;
const PLUGIN_VERSION = getPluginVersion();

interface Arrangement {
  readonly stamp?: string;
  readonly hooksPath?: string;
}

test('names /landmark:install when there is no stamp', (t) => {
  const { stdout } = runCheck(t, { hooksPath: 'own' });

  assert.equal(
    getContext(stdout),
    'yapus landmark is not installed on this machine; run /landmark:install.',
  );
});

test('names /landmark:upgrade when the stamp differs from the plugin version', (t) => {
  const { stdout } = runCheck(t, { stamp: '0.0.1', hooksPath: 'own' });

  assert.equal(
    getContext(stdout),
    `yapus landmark 0.0.1 is installed, the plugin is ${ PLUGIN_VERSION }; run /landmark:upgrade.`,
  );
});

test('names /landmark:upgrade when the global hooks path is unset', (t) => {
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION });

  assert.equal(
    getContext(stdout),
    'yapus landmark: the global core.hooksPath is unset; run /landmark:upgrade.',
  );
});

// Runs the registered command as the harness would, with a copy of the plugin
// as its root; hooksPath 'own' is the path an install sets.
function runCheck(
  t: TestContext,
  arrangement: Arrangement,
): { status: number | null; stdout: string; stderr: string } {
  const tempDir = makeTempDir(t);
  const home = join(tempDir, 'home');
  const root = join(tempDir, 'plugin');
  const gitConfig = join(tempDir, 'gitconfig');
  const ownHooksPath = join(home, '.claude', 'landmark', 'hooks', 'git');
  const hooksPath = arrangement.hooksPath === 'own' ? ownHooksPath : arrangement.hooksPath;

  mkdirSync(home);
  spawnSync('cp', ['-RL', PLUGIN, root]);
  writeFileSync(
    gitConfig,
    hooksPath === undefined ? '' : `[core]\n\thooksPath = ${ hooksPath }\n`,
  );

  if (arrangement.stamp !== undefined) {
    mkdirSync(join(home, '.claude', 'landmark'), { recursive: true });
    writeFileSync(join(home, '.claude', 'landmark', 'version'), arrangement.stamp);
  }

  const sessionEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  const commandRun = spawnSync('bash', ['-c', getRegisteredCommand()], {
    encoding: 'utf8',
    env: {
      ...sessionEnv,
      CLAUDE_PLUGIN_ROOT: root,
      HOME: home,
      GIT_CONFIG_GLOBAL: gitConfig,
    },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { status: commandRun.status, stdout: commandRun.stdout, stderr: commandRun.stderr };
}

// The additionalContext of the SessionStart output, which must be one JSON line.
function getContext(stdout: string): string {
  const output: unknown = JSON.parse(stdout);

  assert.ok(isRecord(output) && isRecord(output.hookSpecificOutput));
  assert.equal(stdout, `${ JSON.stringify(output) }\n`);

  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(typeof context, 'string');

  return String(context);
}

// The command string of the SessionStart entry in hooks.json.
function getRegisteredCommand(): string {
  const hooksText = readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8');
  const checkEntry = /"command": ("(?:[^"\\]|\\.)*landmark\/check(?:[^"\\]|\\.)*")/;
  const commandJson = checkEntry.exec(hooksText)?.[1] ?? '""';
  const command: unknown = JSON.parse(commandJson);

  return typeof command === 'string' ? command : '';
}

// The version in the plugin manifest, which the check compares with the stamp.
function getPluginVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  assert.ok(isRecord(manifest) && typeof manifest.version === 'string');

  return manifest.version;
}
