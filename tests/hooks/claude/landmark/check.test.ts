import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'ordo');
const SUBPROCESS_TIMEOUT_MS = 20000;
const PLUGIN_VERSION = getPluginVersion();

interface Arrangement {
  readonly stamp?: string;
  readonly hooksPath?: string;
  readonly env?: NodeJS.ProcessEnv;
}

test('names /ordo:machine when there is no stamp', (t) => {
  const { stdout } = runCheck(t, { hooksPath: 'own' });

  assert.equal(
    getContext(stdout),
    'yapus landmark is not installed on this machine; run /ordo:machine.',
  );
});

test('names /ordo:upgrade when the stamp differs from the plugin version', (t) => {
  const { stdout } = runCheck(t, { stamp: '0.0.1', hooksPath: 'own' });

  assert.equal(
    getContext(stdout),
    `yapus landmark 0.0.1 is installed, the plugin is ${ PLUGIN_VERSION }; run /ordo:upgrade.`,
  );
});

test('names /ordo:upgrade when the global hooks path is unset', (t) => {
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION });

  assert.equal(
    getContext(stdout),
    'yapus landmark: the global core.hooksPath is unset; run /ordo:upgrade.',
  );
});

test('names the conflict without a command when the global hooks path is foreign', (t) => {
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION, hooksPath: '/elsewhere/hooks' });

  assert.equal(
    getContext(stdout),
    'yapus landmark: the global core.hooksPath is /elsewhere/hooks, not its own; resolve it by hand.',
  );
});

test('names the conflict without a command when the environment injects a hooks path', (t) => {
  const env = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/old',
  };
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION, hooksPath: 'own', env });

  assert.equal(
    getContext(stdout),
    'yapus landmark: GIT_CONFIG_* sets core.hooksPath in this session; retire that injection by hand.',
  );
});

test('stays silent when the stamp matches and the hooks path is its own', (t) => {
  const { status, stdout } = runCheck(t, { stamp: PLUGIN_VERSION, hooksPath: 'own' });

  assert.deepEqual([status, stdout], [0, '']);
});

test('exits 2 with a one-line error on stderr when the plugin manifest is unreadable', (t) => {
  const { status, stdout, stderr } = runCheck(t, {
    stamp: PLUGIN_VERSION,
    hooksPath: 'own',
    breakManifest: true,
  });

  assert.equal(status, 2);
  assert.equal(stdout, '');
  assert.match(stderr, /^yapus landmark check: crashed: [^\n]*; fix the hook\n$/);
});

// Runs the registered command as the harness would, with a copy of the plugin
// as its root; hooksPath 'own' is the path an install sets.
function runCheck(
  t: TestContext,
  arrangement: Arrangement & { readonly breakManifest?: boolean },
): { status: number | null; stdout: string; stderr: string } {
  const tempDir = makeTempDir(t);
  const home = join(tempDir, 'home');
  const root = join(tempDir, 'plugin');
  const gitConfig = join(tempDir, 'gitconfig');
  const ownHooksPath = join(home, '.claude', 'yapus', 'landmark', 'hooks', 'git');
  const hooksPath = arrangement.hooksPath === 'own' ? ownHooksPath : arrangement.hooksPath;

  mkdirSync(home);
  copyPlugin(root);
  writeFileSync(
    gitConfig,
    hooksPath === undefined ? '' : `[core]\n\thooksPath = ${ hooksPath }\n`,
  );

  if (arrangement.stamp !== undefined) {
    mkdirSync(join(home, '.claude', 'yapus', 'landmark'), { recursive: true });
    writeFileSync(join(home, '.claude', 'yapus', 'landmark', 'version'), arrangement.stamp);
  }

  if (arrangement.breakManifest === true) {
    writeFileSync(join(root, '.claude-plugin', 'plugin.json'), '{');
  }

  const sessionEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  const commandRun = spawnSync('bash', ['-c', getRegisteredCommand()], {
    encoding: 'utf8',
    env: {
      ...sessionEnv,
      ...arrangement.env,
      CLAUDE_PLUGIN_ROOT: root,
      HOME: home,
      GIT_CONFIG_GLOBAL: gitConfig,
    },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { status: commandRun.status, stdout: commandRun.stdout, stderr: commandRun.stderr };
}

// cp -RL resolves every link, as the plugin cache does; the copy must hold none.
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
